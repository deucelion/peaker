"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  loadOrganizationBrandingEditorSnapshot,
  saveOrganizationBrandingAction,
  type OrganizationBrandingEditorSnapshot,
} from "@/lib/actions/organizationBrandingActions";
import type { BrandingTheme } from "@/lib/organization/branding/types";
import {
  THEME_TOKEN_GROUPS,
  THEME_TOKEN_LABELS,
} from "@/lib/organization/branding/editorValidation";

type Props = {
  initialSnapshot: OrganizationBrandingEditorSnapshot;
};

function cloneTheme(theme: BrandingTheme): BrandingTheme {
  return { ...theme };
}

export default function OrgBrandingEditor({ initialSnapshot }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [themeDraft, setThemeDraft] = useState<BrandingTheme>(() => cloneTheme(initialSnapshot.branding.theme));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof BrandingTheme, string>>>({});

  const previewStyle = useMemo(
    () => ({
      backgroundColor: themeDraft.background,
      color: themeDraft.textPrimary,
      borderColor: `${themeDraft.primary}33`,
    }),
    [themeDraft]
  );

  function updateToken(key: keyof BrandingTheme, value: string) {
    setThemeDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function handleReload() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const loaded = await loadOrganizationBrandingEditorSnapshot(snapshot.organizationId);
      if (!loaded.ok) {
        setError(loaded.error);
        return;
      }
      setSnapshot(loaded.snapshot);
      setThemeDraft(cloneTheme(loaded.snapshot.branding.theme));
      setFieldErrors({});
      router.refresh();
    });
  }

  function handleSave() {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      setFieldErrors({});

      const result = await saveOrganizationBrandingAction({
        organizationId: snapshot.organizationId,
        expectedRevision: snapshot.brandingRevision,
        theme: themeDraft,
      });

      if (!result.ok) {
        setError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }

      setSnapshot((current) => ({
        ...current,
        brandingRevision: result.brandingRevision,
        branding: {
          ...current.branding,
          theme: cloneTheme(themeDraft),
          brandingRevision: result.brandingRevision,
        },
      }));
      setMessage(`Branding kaydedildi. Yeni revision: ${result.brandingRevision}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 min-w-0">
      <section className="ui-card rounded-[1.5rem] p-4 sm:p-5 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-white text-sm font-black italic uppercase">Organizasyon Branding</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
              Revision: {snapshot.brandingRevision}
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
              disabled={pending}
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
            {error.includes("revision") ? (
              <button
                type="button"
                onClick={handleReload}
                className="mt-2 underline uppercase tracking-wide"
              >
                Guncel veriyi yukle
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4 min-w-0">
          <div className="space-y-4 min-w-0">
            <TokenGroup
              title="Content Theme"
              tokenKeys={THEME_TOKEN_GROUPS.content}
              themeDraft={themeDraft}
              fieldErrors={fieldErrors}
              pending={pending}
              onChange={updateToken}
            />
            <TokenGroup
              title="Sidebar Theme"
              tokenKeys={THEME_TOKEN_GROUPS.sidebar}
              themeDraft={themeDraft}
              fieldErrors={fieldErrors}
              pending={pending}
              onChange={updateToken}
            />
          </div>

          <div className="rounded-xl border border-white/5 p-4 min-w-0" style={previewStyle}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-3">Preview</p>
            <div
              className="rounded-lg border px-3 py-2 mb-3"
              style={{ backgroundColor: themeDraft.surface, color: themeDraft.textPrimary }}
            >
              <p className="text-xs font-black uppercase">Card Surface</p>
              <p className="text-[10px] mt-1" style={{ color: themeDraft.textSecondary }}>
                Secondary text sample
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-[10px] font-black uppercase"
              style={{ backgroundColor: themeDraft.primary, color: themeDraft.textPrimary }}
            >
              Primary Button
            </button>
            <div
              className="mt-3 rounded-lg border px-3 py-2"
              style={{
                backgroundColor: themeDraft.sidebarBackground,
                color: themeDraft.sidebarText,
                borderColor: `${themeDraft.sidebarActive}22`,
              }}
            >
              <p className="text-[10px] font-black uppercase">Sidebar Nav</p>
              <p className="text-[10px] mt-1" style={{ color: themeDraft.sidebarActive }}>
                Active item
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TokenGroup({
  title,
  tokenKeys,
  themeDraft,
  fieldErrors,
  pending,
  onChange,
}: {
  title: string;
  tokenKeys: readonly (keyof BrandingTheme)[];
  themeDraft: BrandingTheme;
  fieldErrors: Partial<Record<keyof BrandingTheme, string>>;
  pending: boolean;
  onChange: (key: keyof BrandingTheme, value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/5 p-3 min-w-0">
      <p className="text-[10px] text-gray-500 font-black uppercase mb-3">{title}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {tokenKeys.map((key) => (
          <label key={key} className="block min-w-0">
            <span className="text-[10px] text-gray-400 font-bold uppercase">{THEME_TOKEN_LABELS[key]}</span>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <input
                type="color"
                value={normalizeColorInput(themeDraft[key])}
                disabled={pending}
                onChange={(event) => onChange(key, event.target.value)}
                className="h-10 w-12 rounded border border-white/5 bg-transparent shrink-0"
                aria-label={`${THEME_TOKEN_LABELS[key]} color picker`}
              />
              <input
                type="text"
                value={themeDraft[key]}
                disabled={pending}
                onChange={(event) => onChange(key, event.target.value.trim())}
                className="ui-input min-h-10 flex-1 font-mono text-[11px]"
                spellCheck={false}
              />
            </div>
            {fieldErrors[key] ? (
              <span className="mt-1 block text-[10px] font-bold text-red-300">{fieldErrors[key]}</span>
            ) : null}
          </label>
        ))}
      </div>
    </div>
  );
}

function normalizeColorInput(value: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [, r, g, b] = value;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}
