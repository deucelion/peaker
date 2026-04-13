"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { mapAthleteProgram, type RawProgram } from "@/lib/mappers";
import type { AthleteProgram } from "@/lib/types";
import { listAthleteProgramsForAthleteView, markProgramRead } from "@/lib/actions/programActions";

export default function MyProgramsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AthleteProgram[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  function isImageAsset(url: string | null) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.includes("image");
  }

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const serverRes = await listAthleteProgramsForAthleteView();
      if ("error" in serverRes) {
        setError(serverRes.error);
        return;
      }

      const mapped = (serverRes.programs || []).map((row) => mapAthleteProgram(row as RawProgram));
      setItems(mapped);
      setSelectedProgramId((prev) => prev || mapped[0]?.id || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  async function openProgram(programId: string) {
    setSelectedProgramId(programId);
    const target = items.find((item) => item.id === programId);
    if (!target || target.isRead) return;
    const result = await markProgramRead(programId);
    if (result?.success) {
      setItems((prev) => prev.map((item) => (item.id === programId ? { ...item, isRead: true } : item)));
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-wide text-gray-500 sm:tracking-widest">Programlar yukleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="min-w-0 border-b border-white/5 pb-5 sm:pb-6">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
          PROGRAMLARIM <span className="text-[#7c3aed]">VE NOTLAR</span>
        </h1>
      </header>

      {error ? (
        <div className="min-w-0 break-words">
          <Notification message={error} variant="error" />
        </div>
      ) : null}

      {!error && items.length === 0 && (
        <div className="min-w-0 rounded-[1.5rem] border border-white/5 bg-[#121215] p-8 text-center sm:rounded-[2rem] sm:p-16">
          <FileText size={40} className="mx-auto mb-4 text-gray-700" aria-hidden />
          <p className="text-gray-500 font-black italic uppercase tracking-widest text-xs">Henuz size atanmis program yok.</p>
        </div>
      )}

      {!error && items.length > 0 && (
        <>
          <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-5 min-w-0">
            <p className="text-[10px] font-black uppercase text-gray-500 mb-3">Aktif / Güncel Program</p>
            {items.find((item) => item.isActive) ? (
              (() => {
                const current = items.find((item) => item.isActive)!;
                return (
                  <button
                    type="button"
                    onClick={() => void openProgram(current.id)}
                    className="w-full min-h-11 text-left bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-xl p-4 touch-manipulation"
                  >
                    <p className="text-white text-base font-black italic uppercase break-words">{current.title}</p>
                    <p className="text-[10px] text-gray-300 font-bold italic break-words">Koç: {current.coachName} - {new Date(current.createdAt).toLocaleString("tr-TR")}</p>
                  </button>
                );
              })()
            ) : (
              <p className="text-[10px] text-gray-500 font-bold italic">Aktif program bulunmuyor.</p>
            )}
          </section>

          <section className="grid lg:grid-cols-12 gap-4 min-w-0">
            <div className="lg:col-span-5 bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 space-y-2 min-w-0">
              <p className="text-[10px] font-black uppercase text-gray-500 mb-2">Program Geçmişi</p>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openProgram(item.id)}
                  className={`w-full min-h-11 text-left rounded-xl border p-3 touch-manipulation min-w-0 ${selectedProgramId === item.id ? "border-[#7c3aed]/40 bg-[#7c3aed]/10" : "border-white/10 bg-white/[0.02]"}`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <p className="text-xs font-black italic text-white uppercase break-words min-w-0 flex-1">{item.title}</p>
                    <span className={`shrink-0 text-[9px] font-black uppercase ${item.isRead ? "text-gray-400" : "text-amber-300"}`}>
                      {item.isRead ? "OKUNDU" : "YENI"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">{new Date(item.createdAt).toLocaleString("tr-TR")}</p>
                </button>
              ))}
            </div>

            <div className="lg:col-span-7 bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 min-w-0 overflow-x-hidden">
              {selectedProgramId ? (
                (() => {
                  const selected = items.find((item) => item.id === selectedProgramId);
                  if (!selected) return <p className="text-[10px] text-gray-500 font-bold italic">Program secilmedi.</p>;
                  return (
                    <div className="space-y-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-white text-lg font-black italic uppercase break-words">{selected.title}</p>
                        <p className="text-[10px] text-gray-500 font-bold italic break-words">
                          Koç: {selected.coachName} - Eklenme: {new Date(selected.createdAt).toLocaleString("tr-TR")}
                        </p>
                        {selected.weekStart && (
                          <p className="text-[10px] text-gray-500 font-bold italic break-words">
                            Hafta: {new Date(selected.weekStart).toLocaleDateString("tr-TR")}
                          </p>
                        )}
                      </div>
                      {selected.pdfUrl && (
                        <a href={selected.pdfUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-3 py-2 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#c4b5fd] text-[10px] font-black uppercase touch-manipulation break-all">
                          DOSYA AC
                        </a>
                      )}
                      {selected.pdfUrl && isImageAsset(selected.pdfUrl) && (
                        <Image
                          src={selected.pdfUrl}
                          alt={selected.title}
                          width={800}
                          height={360}
                          className="max-h-56 w-full max-w-full rounded-xl border border-white/10 object-contain"
                        />
                      )}
                      {selected.content && (
                        <p className="text-[11px] text-gray-300 font-bold italic bg-black/20 border border-white/5 rounded-xl p-3 break-words whitespace-pre-wrap">
                          {selected.content}
                        </p>
                      )}
                    </div>
                  );
                })()
              ) : (
                <p className="text-[10px] text-gray-500 font-bold italic">Detay icin program secin.</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
