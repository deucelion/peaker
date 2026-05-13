"use client";

import { useEffect, useState } from "react";
import { Loader2, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import {
  getMyNotificationPreferences,
  updateMyNotificationPreferences,
} from "@/lib/actions/notificationPreferenceActions";
import {
  NOTIFICATION_CATEGORY_LABELS,
  NOTIFICATION_CATEGORY_TYPES,
  buildCategoryTogglesFromMutedTypes,
  type NotificationCategory,
} from "@/lib/notifications/types";

const CATEGORY_ORDER: NotificationCategory[] = [
  "lesson",
  "program",
  "payment",
  "private_lesson",
  "package",
  "wellness",
];

export function NotificationPreferencesPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [enabled, setEnabled] = useState<Record<NotificationCategory, boolean> | null>(null);

  useEffect(() => {
    if (!open || enabled !== null) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await getMyNotificationPreferences();
      if (cancelled) return;
      if ("error" in res) {
        setError(typeof res.error === "string" ? res.error : "Tercihler alınamadı.");
        setLoading(false);
        return;
      }
      const flags = buildCategoryTogglesFromMutedTypes(res.preference.muted_types);
      setEnabled(flags);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, enabled]);

  function toggleCategory(cat: NotificationCategory, value: boolean) {
    setEnabled((prev) => (prev ? { ...prev, [cat]: value } : prev));
  }

  async function handleSave() {
    if (!enabled) return;
    setSaving(true);
    setError(null);
    const res = await updateMyNotificationPreferences({ enabledCategories: enabled });
    if (res && "error" in res) {
      setError(typeof res.error === "string" ? res.error : "Tercihler kaydedilemedi.");
    } else {
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2400);
    }
    setSaving(false);
  }

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-[#121215] p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white">
          <Settings2 className="size-4 text-[#7c3aed]" aria-hidden />
          Bildirim Tercihleri
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-gray-400">
          {open ? "Kapat" : "Aç"}
          {open ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </span>
      </button>
      {!open ? (
        <p className="mt-2 text-[11px] font-medium text-gray-500">
          Hangi bildirim tiplerini almak istediğinizi buradan yönetebilirsiniz. Kritik bildirimler (ders iptali,
          gecikmiş ödeme) her zaman gönderilir.
        </p>
      ) : null}

      {open ? (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
              <Loader2 className="size-4 animate-spin text-[#7c3aed]" aria-hidden />
              Tercihler yükleniyor...
            </div>
          ) : null}
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200">
              {error}
            </p>
          ) : null}
          {!loading && enabled ? (
            <>
              <ul className="space-y-2">
                {CATEGORY_ORDER.map((cat) => {
                  const meta = NOTIFICATION_CATEGORY_LABELS[cat];
                  const checked = enabled[cat] !== false;
                  const types = NOTIFICATION_CATEGORY_TYPES[cat];
                  return (
                    <li
                      key={cat}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-wide text-white">{meta.title}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-gray-400">{meta.description}</p>
                        <p className="mt-1 text-[10px] font-semibold text-gray-600">
                          Tipler: {types.join(", ")}
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={checked}
                          onChange={(e) => toggleCategory(cat, e.target.checked)}
                          aria-label={meta.title}
                        />
                        <span className="h-6 w-11 rounded-full bg-white/10 transition-colors peer-checked:bg-emerald-500/70" />
                        <span className="absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[10px] font-medium text-gray-500">
                Mute edilemeyen kritik bildirimler:{" "}
                <span className="text-amber-200/90">Ders iptali</span>,{" "}
                <span className="text-amber-200/90">gecikmiş aidat</span>,{" "}
                <span className="text-amber-200/90">paket ödeme gecikmesi</span>,{" "}
                <span className="text-amber-200/90">özel ders iptali</span>.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 text-[11px] font-black uppercase tracking-wide text-white hover:bg-[#6d28d9] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                  Tercihleri kaydet
                </button>
                {savedAt ? (
                  <span className="text-[10px] font-semibold text-emerald-300/90" role="status">
                    Kaydedildi
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
