"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  loadOrganizationFeatureEditorSnapshot,
  saveOrganizationFeaturePresetAction,
  type OrganizationFeatureEditorSnapshot,
} from "@/lib/actions/organizationFeatureActions";
import {
  areConfigurableMapsEqual,
  buildCustomOverrides,
  configurableFromFeatures,
  FEATURE_EDITOR_GROUPS,
  FEATURE_PRESET_ORDER,
  getEntitlementDescription,
  getEntitlementLabel,
  getFeatureBundleParentLabel,
  getFeaturePresetLabel,
  previewPresetConfigurable,
  summarizeConfigurableEntitlements,
} from "@/lib/organization/features/editorPresets";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { getPresetTemplateFlat } from "@/lib/organization/features/presets";
import type { ConfigurableEntitlementKey, FeaturePresetId } from "@/lib/organization/features/types";

type ConfigurableMap = Record<ConfigurableEntitlementKey, boolean>;

type Props = {
  initialSnapshot: OrganizationFeatureEditorSnapshot;
  runtimeEnabled: boolean;
};

function seedCustomDraft(snapshot: OrganizationFeatureEditorSnapshot): ConfigurableMap {
  // Kayitli paket zaten custom ise mevcut efektif durum yuklenir.
  // Aksi halde custom sablonu kullanilir; farkli bir varsayilan uretilmez.
  return snapshot.featurePreset === "custom"
    ? configurableFromFeatures(snapshot.features)
    : getPresetTemplateFlat("custom");
}

export default function OrgPackageEditor({ initialSnapshot, runtimeEnabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [presetDraft, setPresetDraft] = useState<FeaturePresetId>(initialSnapshot.featurePreset);
  const [customDraft, setCustomDraft] = useState<ConfigurableMap>(() => seedCustomDraft(initialSnapshot));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const isCustom = presetDraft === "custom";

  const draftOverrides = useMemo(() => buildCustomOverrides(customDraft), [customDraft]);

  // Tek kaynak: kaydedildiginde olusacak efektif harita.
  const previewConfigurable = useMemo(
    () => previewPresetConfigurable(presetDraft, draftOverrides),
    [presetDraft, draftOverrides]
  );
  const previewSummary = useMemo(
    () => summarizeConfigurableEntitlements(previewConfigurable),
    [previewConfigurable]
  );

  const savedConfigurable = useMemo(() => configurableFromFeatures(snapshot.features), [snapshot.features]);

  const presetChanged = presetDraft !== snapshot.featurePreset;
  const entitlementsChanged = !areConfigurableMapsEqual(previewConfigurable, savedConfigurable);
  const isDirty = presetChanged || entitlementsChanged;

  const savedOverrideCount = Object.keys(snapshot.featureOverrides).length;
  const willClearOverrides = !isCustom && snapshot.featurePreset === "custom";

  function applySnapshot(next: OrganizationFeatureEditorSnapshot) {
    setSnapshot(next);
    setPresetDraft(next.featurePreset);
    setCustomDraft(seedCustomDraft(next));
  }

  function toggleEntitlement(key: ConfigurableEntitlementKey) {
    setCustomDraft((current) => ({ ...current, [key]: !current[key] }));
  }

  function setBundleChildren(children: readonly ConfigurableEntitlementKey[], value: boolean) {
    setCustomDraft((current) => {
      const next = { ...current };
      for (const child of children) {
        next[child] = value;
      }
      return next;
    });
  }

  function handleReload() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      setConflict(false);
      const loaded = await loadOrganizationFeatureEditorSnapshot(snapshot.organizationId);
      if (!loaded.ok) {
        setError(loaded.error);
        return;
      }
      applySnapshot(loaded.snapshot);
      router.refresh();
    });
  }

  function handleSave() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      setConflict(false);

      const result = await saveOrganizationFeaturePresetAction({
        organizationId: snapshot.organizationId,
        expectedRevision: snapshot.featuresRevision,
        preset: presetDraft,
        overrides: isCustom ? draftOverrides : undefined,
      });

      if (!result.ok) {
        setError(result.error);
        setConflict(result.errorKind === "revision_conflict");
        return;
      }

      applySnapshot({
        ...snapshot,
        featurePreset: result.featurePreset,
        featureOverrides: result.featureOverrides,
        features: result.features,
        featuresRevision: result.featuresRevision,
      });
      setMessage(
        `Paket kaydedildi: ${getFeaturePresetLabel(result.featurePreset)}. Yeni revision: ${result.featuresRevision}`
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 min-w-0">
      <section className="ui-card rounded-[1.5rem] p-4 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-white text-sm font-black italic uppercase">Organizasyon Paketi</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
              Aktif paket: <span className="text-white">{getFeaturePresetLabel(snapshot.featurePreset)}</span> •
              Revision: {snapshot.featuresRevision}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReload}
              disabled={pending}
              className="min-h-10 rounded-xl border border-white/5 px-4 text-[10px] font-black uppercase text-gray-300 touch-manipulation disabled:opacity-50"
            >
              Yeniden Yukle
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || !isDirty}
              className="min-h-10 rounded-xl border border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_10%,transparent)] px-4 text-[10px] font-black uppercase text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)] touch-manipulation disabled:opacity-50"
            >
              {pending ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>

        {message ? (
          <p className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-200">
            <p>{error}</p>
            {conflict ? (
              <>
                <p className="mt-1 font-normal">
                  Bu organizasyonun paketi siz bu sayfayi actiktan sonra baska bir super admin tarafindan
                  degistirildi. Degisikliginiz uygulanmadi.
                </p>
                <button type="button" onClick={handleReload} className="mt-2 underline uppercase tracking-wide">
                  Guncel veriyi yukle
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {!runtimeEnabled ? (
          <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-200">
            Platform feature switch kapali. Paket secimi kaydedilir ve burada gorunur, ancak organizasyon
            kullanicilarinin menu/erisim davranisi degismez.
          </p>
        ) : null}

        <div className="grid lg:grid-cols-[1fr_1fr] gap-4 min-w-0">
          <div className="rounded-xl border border-white/5 p-3 min-w-0">
            <p className="text-[10px] text-gray-500 font-black uppercase mb-3">Paket Secimi</p>
            <div className="grid gap-2">
              {FEATURE_PRESET_ORDER.map((preset) => {
                const selected = presetDraft === preset;
                const active = snapshot.featurePreset === preset;
                return (
                  <label
                    key={preset}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 min-w-0 touch-manipulation ${
                      selected
                        ? "border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_35%,transparent)] ui-kpi-chip--brand"
                        : "border-white/5 ui-card-inner"
                    } ${pending ? "opacity-60" : ""}`}
                  >
                    <input
                      type="radio"
                      name="feature-preset"
                      value={preset}
                      checked={selected}
                      disabled={pending}
                      onChange={() => setPresetDraft(preset)}
                      className="mt-0.5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-black italic uppercase text-white break-words">
                        {getFeaturePresetLabel(preset)}
                        {active ? (
                          <span className="ml-2 text-[9px] not-italic text-emerald-300">AKTIF</span>
                        ) : null}
                      </span>
                      <span className="block text-[10px] font-bold text-gray-500 mt-0.5">
                        {describePreset(preset, customDraft)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {isDirty ? (
              <p className="mt-3 text-[10px] font-black uppercase text-amber-200">
                Kaydedilmemiş değişiklikler
                {presetChanged
                  ? `: ${getFeaturePresetLabel(snapshot.featurePreset)} -> ${getFeaturePresetLabel(presetDraft)}`
                  : ": özel paket özellikleri"}
              </p>
            ) : (
              <p className="mt-3 text-[10px] font-bold uppercase text-gray-600">Kaydedildi</p>
            )}

            {willClearOverrides ? (
              <p className="mt-2 text-[10px] font-bold text-amber-200">
                Mevcut özel paket ayarları seçilen standart paketle değiştirilecek ve özel override&apos;lar
                silinecek. ({savedOverrideCount} override)
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/5 p-3 min-w-0">
            <p className="text-[10px] text-gray-500 font-black uppercase mb-3">
              Kaydedilince Olusacak Moduller
            </p>
            <div className="grid gap-1.5">
              {CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => {
                const enabled = previewSummary.enabled.includes(key);
                return (
                  <div key={key} className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-[11px] font-bold text-gray-300 break-words min-w-0">
                      {getEntitlementLabel(key)}
                    </span>
                    <span
                      className={`text-[9px] font-black uppercase shrink-0 ${
                        enabled ? "text-emerald-300" : "text-gray-600"
                      }`}
                    >
                      {enabled ? "Acik" : "Kapali"}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase text-gray-600">
              Cekirdek platform ve sporcu deneyimi her pakette acik kalir.
            </p>
          </div>
        </div>
      </section>

      {isCustom ? (
        <section className="ui-card rounded-[1.5rem] p-4 sm:p-5 min-w-0 border border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_25%,transparent)]">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
            <div className="min-w-0">
              <p className="text-white text-sm font-black italic uppercase">Özel Paket Özellikleri</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                Bu organizasyona özel modül seçimi
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCustomDraft(savedConfigurable)}
              disabled={pending}
              className="min-h-10 rounded-xl border border-white/5 px-4 text-[10px] font-black uppercase text-gray-300 touch-manipulation disabled:opacity-50"
            >
              Mevcut Durumu Kopyala
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-4 min-w-0">
            {FEATURE_EDITOR_GROUPS.map((group) => {
              if (group.kind === "single") {
                return (
                  <EntitlementToggle
                    key={group.key}
                    entitlementKey={group.key}
                    checked={Boolean(customDraft[group.key])}
                    disabled={pending}
                    onToggle={toggleEntitlement}
                  />
                );
              }

              const allOn = group.children.every((child) => customDraft[child]);
              const someOn = group.children.some((child) => customDraft[child]);

              return (
                <div
                  key={group.parent}
                  className="rounded-lg border border-white/5 ui-card-inner p-3 min-w-0 sm:col-span-2"
                >
                  <label className="flex items-start gap-3 min-w-0 touch-manipulation">
                    <BundleParentCheckbox
                      checked={allOn}
                      indeterminate={someOn && !allOn}
                      disabled={pending}
                      onChange={() => setBundleChildren(group.children, !allOn)}
                      label={getFeatureBundleParentLabel(group.parent)}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-black italic uppercase text-white break-words">
                        {getFeatureBundleParentLabel(group.parent)}
                      </span>
                      <span className="block text-[10px] font-bold text-gray-500 mt-0.5">
                        {group.children.length} alt modül • toplu aç/kapat
                      </span>
                    </span>
                  </label>

                  <div className="grid sm:grid-cols-2 gap-2 mt-3 pl-1 sm:pl-6">
                    {group.children.map((child) => (
                      <EntitlementToggle
                        key={child}
                        entitlementKey={child}
                        checked={Boolean(customDraft[child])}
                        disabled={pending}
                        onToggle={toggleEntitlement}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-[10px] font-bold uppercase text-gray-600">
            Çekirdek platform ve sporcu deneyimi her pakette açık kalır ve kapatılamaz.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function EntitlementToggle({
  entitlementKey,
  checked,
  disabled,
  onToggle,
}: {
  entitlementKey: ConfigurableEntitlementKey;
  checked: boolean;
  disabled: boolean;
  onToggle: (key: ConfigurableEntitlementKey) => void;
}) {
  const label = getEntitlementLabel(entitlementKey);
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 min-w-0 touch-manipulation ${
        checked
          ? "border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)] ui-kpi-chip--brand"
          : "border-white/5 ui-card-inner"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={() => onToggle(entitlementKey)}
        className="mt-0.5 shrink-0"
        aria-label={label}
      />
      <span className="min-w-0">
        <span className="block text-[11px] font-black uppercase text-white break-words">{label}</span>
        <span className="block text-[10px] font-bold text-gray-500 mt-0.5 break-words">
          {getEntitlementDescription(entitlementKey)}
        </span>
      </span>
    </label>
  );
}

function BundleParentCheckbox({
  checked,
  indeterminate,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      className="mt-0.5 shrink-0"
      aria-label={label}
    />
  );
}

function describePreset(preset: FeaturePresetId, customDraft: ConfigurableMap): string {
  const configurable =
    preset === "custom" ? customDraft : previewPresetConfigurable(preset, {});
  const summary = summarizeConfigurableEntitlements(configurable);

  if (preset === "custom") {
    return `Seçili modüller: ${summary.enabled.length}/${CONFIGURABLE_ENTITLEMENT_KEYS.length}`;
  }
  if (summary.enabled.length === 0) {
    return "Opsiyonel modul yok — yalnizca cekirdek";
  }
  if (summary.disabled.length === 0) {
    return "Tum opsiyonel moduller acik";
  }
  return summary.enabled.map((key) => getEntitlementLabel(key)).join(", ");
}
