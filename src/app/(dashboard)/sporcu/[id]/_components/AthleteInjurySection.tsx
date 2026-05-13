"use client";

import type { FormEvent } from "react";
import Image from "next/image";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import type { AthleteInjuryNoteRecord } from "@/lib/types";

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
      className="space-y-5 rounded-2xl border border-white/5 bg-[#121215] p-5 shadow-xl md:rounded-3xl md:p-7 min-w-0"
    >
      <div className="flex items-center justify-between gap-3 min-w-0">
        <h2 className="text-base sm:text-lg font-black italic uppercase tracking-tight text-white break-words">
          Sakatlık <span className="text-[#7c3aed]">geçmişi</span>
        </h2>
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Kayıt yönetimi</span>
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

      <form onSubmit={onCreate} className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-black/30 p-4 sm:grid-cols-2">
        <input
          value={injuryType}
          onChange={(e) => onInjuryTypeChange(e.target.value)}
          placeholder="Sakatlık türü (örn: Hamstring zorlanması)"
          className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed] sm:col-span-2"
        />
        <textarea
          value={injuryNoteText}
          onChange={(e) => onInjuryNoteChange(e.target.value)}
          placeholder="Koç notu"
          rows={3}
          className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#7c3aed] sm:col-span-2"
        />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(e) => onInjuryImagesChange(Array.from(e.target.files || []))}
          className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[10px] font-bold text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#7c3aed] file:px-3 file:py-1.5 file:text-[10px] file:font-black file:text-white sm:col-span-2"
        />
        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider sm:col-span-2">
          En fazla 5 görsel, her biri max 6 MB (JPEG/PNG/WebP/GIF)
        </p>
        <button
          type="submit"
          disabled={injurySaving}
          className="min-h-11 rounded-xl bg-[#7c3aed] px-4 py-3 text-[10px] font-black uppercase text-white disabled:opacity-60 sm:w-fit"
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
            <article key={item.id} className="rounded-2xl border border-white/5 bg-black/25 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase text-white break-words">{item.injuryType}</p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                    {new Date(item.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
                    {item.createdByName}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deactivatingInjuryId === item.id}
                  onClick={() => onDeactivate(item.id)}
                  className="min-h-11 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-black uppercase text-red-300 disabled:opacity-40"
                >
                  {deactivatingInjuryId === item.id ? "Pasife alınıyor..." : "Pasife al"}
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm font-bold text-gray-300">{item.note}</p>
              {item.assets.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {item.assets.map((asset) => (
                    <a
                      key={asset.path}
                      href={asset.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-xl border border-white/10 bg-black/40"
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
