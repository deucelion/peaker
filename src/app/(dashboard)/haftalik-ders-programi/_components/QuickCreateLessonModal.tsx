"use client";

import Notification from "@/components/Notification";
import { OverlayDialog, OVERLAY_Z } from "@/components/ui/overlay";
import type { PrivateLessonPackage } from "@/lib/types";

export type GroupForm = {
  title: string;
  coachId: string;
  startClock: string;
  endClock: string;
  durationMinutes: string;
  location: string;
  capacity: string;
};

export type PrivateForm = {
  packageId: string;
  startClock: string;
  endClock: string;
  durationMinutes: string;
  coachId: string;
  location: string;
};

type TimeValidation = { ok: boolean; message: string };

/**
 * Faz 6.1 — Takvimden hızlı ders oluşturma modalı.
 *
 * State container (parent) bütün state ve submit handler'larını yönetir;
 * modal yalnızca markup + callback köprüsüdür. Davranış birebir korunmuştur.
 */
export function QuickCreateLessonModal(props: {
  quickCreateAt: Date;
  quickMode: "group" | "private";
  quickBusy: boolean;
  quickError: string | null;
  quickInfo: string | null;
  quickCreateDateLabel: string;
  quickCreateTimeLabel: string;
  quickCoachOptions: Array<{ id: string; full_name: string }>;
  quickPackages: PrivateLessonPackage[];
  quickHasActivePackage: boolean;
  canQuickPrivateCreate: boolean;
  groupForm: GroupForm;
  privateForm: PrivateForm;
  quickGroupTitle: string;
  locationOptions: Array<{ id: string; name: string; color: string }>;
  newLocationName: string;
  newLocationColor: string;
  locationBusy: boolean;
  groupTimeValidation: TimeValidation;
  privateTimeValidation: TimeValidation;
  inlineTimePreview: string;
  onClose: () => void;
  onChangeMode: (mode: "group" | "private") => void;
  onChangeQuickGroupTitle: (next: string) => void;
  onChangeGroupForm: (updater: (prev: GroupForm) => GroupForm) => void;
  onChangePrivateForm: (updater: (prev: PrivateForm) => PrivateForm) => void;
  onChangeNewLocationName: (next: string) => void;
  onChangeNewLocationColor: (next: string) => void;
  onSyncGroupDurationFromRange: (start: string, end: string) => void;
  onSyncGroupEndFromDuration: (start: string, duration: string) => void;
  onSyncPrivateDurationFromRange: (start: string, end: string) => void;
  onSyncPrivateEndFromDuration: (start: string, duration: string) => void;
  onSubmitQuickGroup: () => void;
  onSubmitOneClickGroup: () => void;
  onSubmitQuickPrivate: () => void;
  onSubmitOneClickPrivate: () => void;
  onCreateLocation: () => void;
}) {
  const {
    quickMode,
    quickBusy,
    quickError,
    quickInfo,
    quickCreateDateLabel,
    quickCreateTimeLabel,
    quickCoachOptions,
    quickPackages,
    quickHasActivePackage,
    canQuickPrivateCreate,
    groupForm,
    privateForm,
    quickGroupTitle,
    locationOptions,
    newLocationName,
    newLocationColor,
    locationBusy,
    groupTimeValidation,
    privateTimeValidation,
    inlineTimePreview,
    onClose,
    onChangeMode,
    onChangeQuickGroupTitle,
    onChangeGroupForm,
    onChangePrivateForm,
    onChangeNewLocationName,
    onChangeNewLocationColor,
    onSyncGroupDurationFromRange,
    onSyncGroupEndFromDuration,
    onSyncPrivateDurationFromRange,
    onSyncPrivateEndFromDuration,
    onSubmitQuickGroup,
    onSubmitOneClickGroup,
    onSubmitQuickPrivate,
    onSubmitOneClickPrivate,
    onCreateLocation,
  } = props;

  const selectedPackage = quickPackages.find((p) => p.id === privateForm.packageId) || null;

  return (
    <OverlayDialog
      open
      onClose={onClose}
      layer={OVERLAY_Z.MODAL_ELEVATED}
      strongBackdrop
      shellClassName="w-full max-w-lg rounded-2xl ui-card p-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] !max-w-lg sm:!p-6"
    >
        <p className="text-[10px] font-black uppercase tracking-[0.2em] ui-kpi-card__trend">Hızlı planlama</p>
        <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white">Takvimden ders oluştur</h3>
        <p className="mt-2 text-sm font-bold text-gray-400">
          Seçilen zaman: <span className="text-white">{quickCreateDateLabel}</span> ·{" "}
          <span className="text-white">{quickCreateTimeLabel}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onChangeMode("group")}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${ quickMode === "group" ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100" : "ui-btn-ghost text-gray-300" }`}
          >
            Grup Dersi
          </button>
          <button
            type="button"
            onClick={() => onChangeMode("private")}
            className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${ quickMode === "private" ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100" : "ui-btn-ghost text-gray-300" }`}
          >
            Özel Ders
          </button>
        </div>
        {quickError ? (
          <div className="mt-3">
            <Notification message={quickError} variant="error" />
          </div>
        ) : null}
        {quickInfo ? (
          <p className="mt-3 rounded-lg border border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_25%,transparent)] ui-kpi-band px-3 py-2 text-[11px] font-semibold ui-kpi-card__trend">
            {quickInfo}
          </p>
        ) : null}
        <div className="mt-4 rounded-xl ui-kpi-band p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-kpi-card__trend">⚡ Hızlı Oluştur</p>
          {quickMode === "group" ? (
            <div className="mt-2 space-y-2">
              <input
                value={quickGroupTitle}
                onChange={(e) => onChangeQuickGroupTitle(e.target.value)}
                placeholder="Ders adı (opsiyonel)"
                className="ui-input"
              />
              <p className="text-[11px] font-semibold text-gray-400">
                Son koç + varsayılan süre ile tek tık oluşturma.
              </p>
              <button
                type="button"
                disabled={quickBusy || !groupForm.coachId || !groupTimeValidation.ok}
                onClick={onSubmitOneClickGroup}
                className="rounded-lg border border-indigo-400/40 bg-indigo-500/25 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-indigo-100 disabled:opacity-50"
              >
                {quickBusy
                  ? "Oluşturuluyor…"
                  : `⚡ ${groupForm.startClock || "--:--"} - ${groupForm.endClock || "--:--"} ders oluştur`}
              </button>
            </div>
          ) : canQuickPrivateCreate ? (
            <div className="mt-2 space-y-2">
              <p className="text-[11px] font-semibold text-gray-400">
                Tek aktif paket bulundu. Paket ve koç otomatik seçilerek tek tık planlama yapılır.
              </p>
              <button
                type="button"
                disabled={quickBusy}
                onClick={onSubmitOneClickPrivate}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/25 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-100 disabled:opacity-50"
              >
                {quickBusy
                  ? "Planlanıyor…"
                  : `⚡ ${privateForm.startClock || "--:--"} - ${privateForm.endClock || "--:--"} özel ders`}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] font-semibold text-gray-500">
              Hızlı özel ders için tek aktif paket + paket koçu gereklidir. Manuel formu kullanabilirsiniz.
            </p>
          )}
        </div>
        <div className="mt-4 border-t border-[color:color-mix(in_srgb,var(--peaker-ui-TEXT_SECONDARY,#6b7280)_15%,transparent)]" />
        {quickBusy ? (
          <p className="mt-3 text-[11px] font-semibold text-gray-400">İşlem hazırlanıyor…</p>
        ) : quickMode === "group" ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Ders adı</span>
              <input
                value={groupForm.title}
                onChange={(e) => onChangeGroupForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Örn. Teknik ve pas çalışması"
                className="ui-input"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Koç</span>
                <select
                  value={groupForm.coachId}
                  onChange={(e) => onChangeGroupForm((p) => ({ ...p, coachId: e.target.value }))}
                  className="ui-select"
                >
                  {quickCoachOptions.length === 0 ? <option value="">Koç bulunamadı</option> : null}
                  {quickCoachOptions.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.full_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Başlangıç saati</span>
                <input
                  type="time"
                  step={900}
                  value={groupForm.startClock}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    onChangeGroupForm((p) => ({ ...p, startClock: nextStart }));
                    onSyncGroupDurationFromRange(nextStart, groupForm.endClock);
                  }}
                  className="ui-input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Bitiş saati</span>
                <input
                  type="time"
                  step={900}
                  value={groupForm.endClock}
                  onChange={(e) => {
                    const nextEnd = e.target.value;
                    onChangeGroupForm((p) => ({ ...p, endClock: nextEnd }));
                    onSyncGroupDurationFromRange(groupForm.startClock, nextEnd);
                  }}
                  className="ui-input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Süre (dk)</span>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={groupForm.durationMinutes}
                  onChange={(e) => {
                    const nextDuration = e.target.value;
                    onChangeGroupForm((p) => ({ ...p, durationMinutes: nextDuration }));
                    onSyncGroupEndFromDuration(groupForm.startClock, nextDuration);
                  }}
                  className="ui-input"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Kapasite</span>
                <input
                  type="number"
                  min={1}
                  value={groupForm.capacity}
                  onChange={(e) => onChangeGroupForm((p) => ({ ...p, capacity: e.target.value }))}
                  className="ui-input"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Lokasyon</span>
                {locationOptions.length > 0 ? (
                  <select
                    value={groupForm.location}
                    onChange={(e) => onChangeGroupForm((p) => ({ ...p, location: e.target.value }))}
                    className="ui-select"
                  >
                    {locationOptions.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100">
                    Kayıtlı lokasyon yok. Aşağıdan yeni lokasyon ekleyin.
                  </p>
                )}
              </label>
            </div>
            {inlineTimePreview ? (
              <p className="rounded-lg border border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_25%,transparent)] ui-kpi-band px-3 py-2 text-[11px] font-semibold ui-kpi-card__trend">
                {inlineTimePreview}
              </p>
            ) : null}
            {!groupTimeValidation.ok ? (
              <p className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-200">
                {groupTimeValidation.message}
              </p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onSubmitQuickGroup}
                disabled={quickBusy || !groupTimeValidation.ok}
                className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-indigo-100 disabled:opacity-50"
              >
                {quickBusy ? "Kaydediliyor…" : "Grup dersini oluştur"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {!quickHasActivePackage ? (
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3">
                <p className="text-[12px] font-black text-amber-100">Planlanabilir aktif paket yok</p>
                <p className="mt-1 text-[11px] font-semibold text-amber-100/90">
                  Bu zaman için planlanabilecek aktif özel ders paketi bulunmuyor.
                </p>
              </div>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Aktif paket</span>
                  <select
                    value={privateForm.packageId}
                    onChange={(e) => {
                      const next = quickPackages.find((p) => p.id === e.target.value);
                      onChangePrivateForm((p) => ({
                        ...p,
                        packageId: e.target.value,
                        coachId: next?.coachId || "",
                      }));
                    }}
                    className="ui-select"
                  >
                    {quickPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.athleteName} | {pkg.packageName} | Kalan {pkg.remainingLessons} ders
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Başlangıç saati</span>
                    <input
                      type="time"
                      step={900}
                      value={privateForm.startClock}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        onChangePrivateForm((p) => ({ ...p, startClock: nextStart }));
                        onSyncPrivateDurationFromRange(nextStart, privateForm.endClock);
                      }}
                      className="ui-input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Bitiş saati</span>
                    <input
                      type="time"
                      step={900}
                      value={privateForm.endClock}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        onChangePrivateForm((p) => ({ ...p, endClock: nextEnd }));
                        onSyncPrivateDurationFromRange(privateForm.startClock, nextEnd);
                      }}
                      className="ui-input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Süre (dk)</span>
                    <input
                      type="number"
                      min={15}
                      step={15}
                      value={privateForm.durationMinutes}
                      onChange={(e) => {
                        const nextDuration = e.target.value;
                        onChangePrivateForm((p) => ({ ...p, durationMinutes: nextDuration }));
                        onSyncPrivateEndFromDuration(privateForm.startClock, nextDuration);
                      }}
                      className="ui-input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Koç</span>
                    <select
                      value={privateForm.coachId}
                      onChange={(e) => onChangePrivateForm((p) => ({ ...p, coachId: e.target.value }))}
                      className="ui-select"
                    >
                      <option value="">Koç seçin</option>
                      {quickCoachOptions.map((coach) => (
                        <option key={coach.id} value={coach.id}>
                          {coach.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Lokasyon</span>
                    {locationOptions.length > 0 ? (
                      <select
                        value={privateForm.location}
                        onChange={(e) => onChangePrivateForm((p) => ({ ...p, location: e.target.value }))}
                        className="ui-select"
                      >
                        {locationOptions.map((loc) => (
                          <option key={loc.id} value={loc.name}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100">
                        Kayıtlı lokasyon yok. Aşağıdan yeni lokasyon ekleyin.
                      </p>
                    )}
                  </label>
                </div>
                {!privateTimeValidation.ok ? (
                  <p className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-200">
                    {privateTimeValidation.message}
                  </p>
                ) : null}
                {selectedPackage ? (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px]">
                    <p className="font-black text-emerald-100">Seçili paket</p>
                    <p className="mt-1 font-semibold text-emerald-50/95">
                      {selectedPackage.athleteName} · {selectedPackage.packageName}
                    </p>
                    <p className="mt-0.5 font-semibold text-emerald-100/80">
                      Kalan ders: {selectedPackage.remainingLessons}
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={onSubmitQuickPrivate}
                    disabled={quickBusy}
                    className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-100 disabled:opacity-50"
                  >
                    {quickBusy ? "Kaydediliyor…" : "Özel dersi planla"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        <div className="mt-4 rounded-xl ui-kpi-band p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-kpi-card__trend">Lokasyon ekle</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
            <input
              value={newLocationName}
              onChange={(e) => onChangeNewLocationName(e.target.value)}
              placeholder="Örn. Ana Salon"
              className="ui-input"
            />
            <input
              type="color"
              value={newLocationColor}
              onChange={(e) => onChangeNewLocationColor(e.target.value)}
              className="ui-input h-11 p-1"
            />
            <button
              type="button"
              onClick={onCreateLocation}
              disabled={locationBusy}
              className="ui-btn-ghost min-h-11 px-4"
            >
              {locationBusy ? "Ekleniyor..." : "Lokasyon ekle"}
            </button>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className="ui-btn-ghost min-h-11 px-4">
            Kapat
          </button>
        </div>
    </OverlayDialog>
  );
}

export default QuickCreateLessonModal;
