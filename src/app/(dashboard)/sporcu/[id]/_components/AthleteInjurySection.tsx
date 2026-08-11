"use client";

import type { FormEvent } from "react";
import Image from "next/image";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import type { AthleteInjuryNoteRecord } from "@/lib/types";

const INPUT_CLASS = uiBrandingClasses.form.input;

/**
 * Faz 7.7 — Sakatlık geçmişi bölümü.
 * Form + liste; tüm state ve handler'lar parent'tan gelir.
 */
export function AthleteInjurySection({
  injuryNotes,
  injuryMessage,
  injuryType,
  injuryNoteText,
  injurySaving,
  deactivatingInjuryId,
  onInjuryTypeChange,
  onInjuryNoteChange,
  onInjuryImagesChange,
  onCreate,
  onDeactivate,
}: {
  injuryNotes: AthleteInjuryNoteRecord[];
  injuryMessage: string | null;
  injuryType: string;
  injuryNoteText: string;
  injurySaving: boolean;
  deactivatingInjuryId: string | null;
  onInjuryTypeChange: (value: string) => void;
  onInjuryNoteChange: (value: string) => void;
  onInjuryImagesChange: (files: File[]) => void;
  onCreate: (e: FormEvent) => void;
  onDeactivate: (noteId: string) => void;
}) {
  return (
    <section
      id="sakatlik-gecmisi"
      className={`${uiBrandingClasses.card.base} min-w-0 space-y-5 rounded-2xl p-5 shadow-xl md:rounded-3xl md:p-7`}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <h2 className={`${uiBrandingClasses.typography.h2} break-words text-base sm:text-lg`}>
          Sakatlık <span className="text-[color:var(--peaker-ui-PRIMARY)]">geçmişi</span>
        </h2>
        <span className={`${uiBrandingClasses.kpi.cardHint} text-[9px] font-bold uppercase tracking-widest`}>
          Kayıt yönetimi
        </span>
      </div>

      {injuryMessage ? (
        <Notification
          message={injuryMessage}
          variant={
            injuryMessage.toLowerCase().includes("eklendi") || injuryMessage.toLowerCase().includes("pasife")
              ? "success"
              : "error"
          }
        />
      ) : null}

      <form
        onSubmit={onCreate}
        className={`${uiBrandingClasses.card.inner} grid grid-cols-1 gap-3 rounded-2xl p-4 sm:grid-cols-2`}
      >
        <input
          value={injuryType}
          onChange={(e) => onInjuryTypeChange(e.target.value)}
          placeholder="Sakatlık türü (örn: Hamstring zorlanması)"
          className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-xs font-black sm:col-span-2`}
        />
        <textarea
          value={injuryNoteText}
          onChange={(e) => onInjuryNoteChange(e.target.value)}
          placeholder="Koç notu"
          rows={3}
          className={`${uiBrandingClasses.form.textarea} min-h-11 w-full min-w-0 px-4 py-3 text-xs font-bold sm:col-span-2`}
        />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(e) => onInjuryImagesChange(Array.from(e.target.files || []))}
          className={`${INPUT_CLASS} min-h-11 px-4 py-3 text-[10px] font-bold text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-[10px] file:font-black file:text-white sm:col-span-2 file:bg-[color:var(--peaker-ui-PRIMARY)]`}
        />
        <p className={`${uiBrandingClasses.kpi.cardHint} text-[9px] font-bold uppercase tracking-wider sm:col-span-2`}>
          En fazla 5 görsel, her biri max 6 MB (JPEG/PNG/WebP/GIF)
        </p>
        <button
          type="submit"
          disabled={injurySaving}
          className={`${uiBrandingClasses.button.primary} min-h-11 px-4 py-3 text-[10px] sm:w-fit`}
        >
          {injurySaving ? "Kaydediliyor..." : "Sakatlık Kaydı Ekle"}
        </button>
      </form>

      {injuryNotes.length === 0 ? (
        <EmptyState
          variant="no_data"
          title="Henüz sakatlık kaydı yok"
          description="Yeni kayıt için aşağıdaki formu doldurun; görsel eklemek opsiyoneldir."
          compact
        />
      ) : (
        <div className="space-y-3">
          {injuryNotes.map((item) => (
            <article key={item.id} className={`${uiBrandingClasses.kpi.band} rounded-2xl p-4 sm:p-5`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className={`${uiBrandingClasses.kpi.cardValue} break-words text-xs uppercase`}>
                    {item.injuryType}
                  </p>
                  <p className={`${uiBrandingClasses.kpi.cardHint} mt-1 text-[10px] font-bold uppercase`}>
                    {new Date(item.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {item.createdByName}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deactivatingInjuryId === item.id}
                  onClick={() => onDeactivate(item.id)}
                  className={`${uiBrandingClasses.button.danger} min-h-11 px-3 text-[10px] disabled:opacity-40`}
                >
                  {deactivatingInjuryId === item.id ? "Pasife alınıyor..." : "Pasife al"}
                </button>
              </div>
              <p className={`${uiBrandingClasses.typography.body} mt-3 whitespace-pre-wrap text-sm font-bold`}>
                {item.note}
              </p>
              {item.assets.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {item.assets.map((asset) => (
                    <a
                      key={asset.path}
                      href={asset.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`${uiBrandingClasses.card.inner} group overflow-hidden`}
                    >
                      <Image
                        src={asset.signedUrl}
                        alt={item.injuryType}
                        width={320}
                        height={192}
                        unoptimized
                        className="h-24 w-full object-cover transition-transform sm:group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AthleteInjurySection;
