"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Plus, Search } from "lucide-react";
import Notification from "@/components/Notification";
import {
  createAthleteProgram,
  listAthleteProgramsForManagementUI,
  setProgramActive,
  updateAthleteProgramContent,
} from "@/lib/actions/programActions";
import { listManagementDirectory } from "@/lib/actions/managementDirectoryActions";
import { mapAthleteProgram, type RawProgram } from "@/lib/mappers";
import type { AthleteProgram } from "@/lib/types";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { profileRowIsActive } from "@/lib/coach/lifecycle";

interface CoachOption {
  id: string;
  full_name: string;
}

interface AthleteOption {
  id: string;
  full_name: string;
  is_active?: boolean | null;
}

export default function ProgramNotesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"admin" | "coach" | "sporcu">("sporcu");
  const [actorUserId, setActorUserId] = useState<string>("");
  const [permissions, setPermissions] = useState(DEFAULT_COACH_PERMISSIONS);
  const [programs, setPrograms] = useState<AthleteProgram[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [editProgramId, setEditProgramId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "", weekStart: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    weekStart: "",
    coachId: "",
  });

  function isImageAsset(url: string | null) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.includes("image");
  }

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const directory = await listManagementDirectory();
      if ("error" in directory) {
        setError(directory.error ?? "Veri dizini alinamadi.");
        return;
      }

      const resolvedRole = directory.role;
      setActorUserId(directory.actorUserId);
      const resolvedPermissions = directory.permissions ?? DEFAULT_COACH_PERMISSIONS;
      setRole(resolvedRole);
      setPermissions(resolvedPermissions);

      const [programRes, coachRes, athleteRes] = await Promise.all([
        listAthleteProgramsForManagementUI(),
        Promise.resolve({ data: directory.coaches as CoachOption[], error: null }),
        Promise.resolve({ data: directory.athletes as AthleteOption[], error: null }),
      ]);

      if ("error" in programRes) {
        setError(programRes.error);
        return;
      }

      setPrograms((programRes.programs || []).map((row) => mapAthleteProgram(row as RawProgram)));
      setCoaches((coachRes.data || []) as CoachOption[]);
      const athleteRows = (athleteRes.data || []) as AthleteOption[];
      setAthletes(
        athleteRows.filter((a) => profileRowIsActive(a.is_active)).map(({ id, full_name }) => ({ id, full_name }))
      );

      if (resolvedRole === "coach") {
        setForm((prev) => ({ ...prev, coachId: directory.actorUserId }));
      } else if ((coachRes.data || []).length > 0) {
        setForm((prev) => ({ ...prev, coachId: prev.coachId || coachRes.data![0].id }));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.athleteName.toLowerCase().includes(q) ||
        p.coachName.toLowerCase().includes(q)
    );
  }, [programs, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("content", form.content);
    fd.append("weekStart", form.weekStart);
    fd.append("coachId", form.coachId);
    if (attachment) fd.append("attachment", attachment);
    selectedAthletes.forEach((id) => fd.append("athleteIds", id));

    const result = await createAthleteProgram(fd);
    if (result?.success) {
      setMessage("Program ve notlar kaydedildi.");
      setForm((prev) => ({ ...prev, title: "", content: "", weekStart: "" }));
      setSelectedAthletes([]);
      setAttachment(null);
      await fetchData();
    } else {
      setMessage(result?.error || "Program kaydedilemedi.");
    }
    setSaving(false);
  }

  async function handleToggleActive(programId: string, isActive: boolean) {
    const result = await setProgramActive(programId, isActive);
    if (result?.success) {
      await fetchData();
    } else {
      setMessage(result?.error || "Program durumu guncellenemedi.");
    }
  }

  function openProgramEdit(p: AthleteProgram) {
    setEditProgramId(p.id);
    setEditForm({
      title: p.title,
      content: p.content,
      weekStart: p.weekStart ? p.weekStart.slice(0, 10) : "",
    });
    setMessage(null);
  }

  async function handleProgramEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editProgramId) return;
    if (role === "coach" && !permissions.can_manage_training_notes) {
      setMessage("Program duzenleme yetkiniz yok.");
      return;
    }
    setEditSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("programId", editProgramId);
    fd.append("title", editForm.title);
    fd.append("content", editForm.content);
    fd.append("weekStart", editForm.weekStart);
    const result = await updateAthleteProgramContent(fd);
    if (result?.success) {
      setEditProgramId(null);
      setMessage("Program icerigi guncellendi.");
      await fetchData();
    } else {
      setMessage(result?.error || "Program guncellenemedi.");
    }
    setEditSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-[50dvh] px-4 flex flex-col items-center justify-center gap-4 min-w-0 overflow-x-hidden pb-[max(env(safe-area-inset-bottom,0px),0.5rem)] text-center">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-gray-500 font-black italic uppercase text-[10px] tracking-wide sm:tracking-widest break-words max-w-md">
          Program modulu yukleniyor...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-white/5 pb-5 sm:pb-6 min-w-0">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
            NOTLAR & <span className="text-[#7c3aed]">HAFTALIK PROGRAM</span>
          </h1>
          <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] italic mt-2 sm:mt-3 border-l-2 border-[#7c3aed] pl-3 sm:pl-4 break-words">
            Sporcu bazli plan ve koc notlari
          </p>
        </div>
        <div className="relative w-full md:w-72 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={16} aria-hidden />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="PROGRAM ARA..."
            className="w-full min-h-11 bg-[#121215] border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-base sm:text-xs font-black italic uppercase text-white outline-none focus:border-[#7c3aed]/50 touch-manipulation"
          />
        </div>
      </header>

      {(error || message) && (
        <div className="min-w-0 break-words">
          <Notification message={error || message || ""} variant={error ? "error" : message?.toLowerCase().includes("kaydedildi") ? "success" : "info"} />
        </div>
      )}
      {!error && role === "coach" && !permissions.can_manage_training_notes && (
        <div className="min-w-0 break-words">
          <Notification message="Antrenor notu/program yonetim yetkiniz kapali." variant="info" />
        </div>
      )}
      {!error && role === "admin" && coaches.length === 0 && (
        <div className="min-w-0 break-words">
          <Notification message="Koç listesi boş. Önce bir koç oluşturun." variant="info" />
        </div>
      )}

      {!error && (
        <form
          onSubmit={handleCreate}
          className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 min-w-0 [&_input:not([type=file])]:min-h-11 [&_input:not([type=file])]:text-base [&_input:not([type=file])]:sm:text-xs [&_select]:min-h-11 [&_select]:text-base [&_select]:sm:text-xs [&_textarea]:text-base [&_textarea]:sm:text-xs"
        >
          <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2 break-words">
            <Plus size={16} className="text-[#7c3aed] shrink-0" aria-hidden /> Yeni Program/Not
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest italic ml-1">Baslik</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="HAFTALIK KUVVET PLANI"
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white outline-none focus:border-[#7c3aed]/60 touch-manipulation"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest italic ml-1">Hafta Baslangici</label>
              <input
                type="date"
                value={form.weekStart}
                onChange={(e) => setForm((p) => ({ ...p, weekStart: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white outline-none focus:border-[#7c3aed]/60 touch-manipulation"
              />
            </div>
            <div className="md:col-span-2 space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest italic ml-1">Antrenor Notu</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                placeholder="HAFTA ODAK NOKTASI, ÖZEL TALİMAT, YÜKLENME NOTLARI..."
                rows={4}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white outline-none focus:border-[#7c3aed]/60 touch-manipulation"
              />
            </div>
            <div className="md:col-span-2 space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest italic ml-1">Dosya (PDF / Gorsel)</label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-sm sm:text-xs font-black italic text-white outline-none focus:border-[#7c3aed]/60 touch-manipulation file:mr-3 file:rounded-lg file:border-0 file:bg-[#7c3aed]/20 file:px-3 file:py-1.5 file:text-[10px] file:font-black file:uppercase"
              />
              <p className="text-[9px] text-gray-600 font-bold italic">Maksimum 10MB</p>
            </div>
            {role === "admin" ? (
              <div className="space-y-1 min-w-0">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest italic ml-1">Koç Seçimi</label>
                <select
                  value={form.coachId}
                  onChange={(e) => setForm((p) => ({ ...p, coachId: e.target.value }))}
                  className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white outline-none focus:border-[#7c3aed]/60 touch-manipulation"
                >
                  {coaches.length === 0 && <option value="">KOÇ BULUNAMADI</option>}
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.full_name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1 min-w-0">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest italic ml-1">Koç</label>
                <input value="KOÇ: BEN" readOnly className="w-full min-w-0 min-h-11 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-base sm:text-xs font-black italic text-gray-400" />
              </div>
            )}
          </div>

          <div className="bg-[#1c1c21] border border-white/10 rounded-xl p-3 min-w-0">
            <p className="text-[10px] font-black uppercase text-gray-500 mb-2">Sporcu Seçimi</p>
            <div className="max-h-48 sm:max-h-40 overflow-y-auto overflow-x-hidden grid md:grid-cols-2 gap-2 min-w-0 [-webkit-overflow-scrolling:touch]">
              {athletes.map((athlete) => {
                const checked = selectedAthletes.includes(athlete.id);
                return (
                  <label key={athlete.id} className="flex items-start gap-3 text-[11px] text-gray-300 font-bold min-w-0 touch-manipulation py-0.5">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 shrink-0 touch-manipulation"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedAthletes((prev) =>
                          e.target.checked ? [...prev, athlete.id] : prev.filter((id) => id !== athlete.id)
                        )
                      }
                    />
                    <span className="break-words min-w-0">{athlete.full_name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || selectedAthletes.length === 0 || (role === "admin" && coaches.length === 0) || (role === "coach" && !permissions.can_manage_training_notes)}
            className="min-h-11 w-full sm:w-auto px-6 py-3 rounded-xl bg-[#7c3aed] sm:hover:bg-[#6d28d9] text-white text-[10px] font-black uppercase tracking-wide sm:tracking-widest disabled:opacity-60 touch-manipulation"
          >
            {saving ? "KAYDEDILIYOR..." : "PROGRAMI EKLE"}
          </button>
        </form>
      )}

      {!error && filteredPrograms.length === 0 && (
        <div className="p-10 sm:p-16 text-center bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] min-w-0">
          <FileText size={40} className="mx-auto text-gray-700 mb-4" aria-hidden />
          <p className="text-gray-500 font-black italic uppercase tracking-widest text-xs">Program kaydı bulunamadı.</p>
        </div>
      )}

      {!error && filteredPrograms.length > 0 && (
        <div className="grid gap-3 min-w-0">
          {filteredPrograms.map((program) => (
            <div key={program.id} className="bg-[#121215] border border-white/5 rounded-[1.75rem] p-4 min-w-0">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-base sm:text-lg font-black italic uppercase break-words">{program.title}</p>
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">
                    Sporcu: {program.athleteName} - Koç: {program.coachName}
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">
                    Eklenme: {new Date(program.createdAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 text-[10px] font-black uppercase min-w-0">
                  <span className={`px-3 py-2 sm:py-1 rounded-xl border text-center sm:text-left ${program.isRead ? "text-gray-300 border-white/10 bg-white/5" : "text-amber-300 border-amber-500/20 bg-amber-500/10"}`}>
                    {program.isRead ? "OKUNDU" : "YENI"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(program.id, !program.isActive)}
                    className={`min-h-11 px-3 py-2 rounded-xl border w-full sm:w-auto max-w-full sm:max-w-[220px] text-left leading-tight touch-manipulation ${program.isActive ? "text-green-400 border-green-500/20 bg-green-500/10" : "text-gray-300 border-white/10 bg-white/5"}`}
                    title={program.isActive ? "Kaydi silmez; sporcu listesinde gizlenir." : "Kaydi tekrar gorunur yapar."}
                  >
                    {program.isActive ? "Pasif yap (silmeden gizle)" : "Tekrar aktif et"}
                  </button>
                  {(role === "admin" || (role === "coach" && permissions.can_manage_training_notes && program.coachId === actorUserId)) && (
                    <button
                      type="button"
                      onClick={() => openProgramEdit(program)}
                      className="min-h-11 px-3 py-2 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 text-[#e9d5ff] touch-manipulation w-full sm:w-auto"
                    >
                      Icerigi duzenle
                    </button>
                  )}
                  {program.weekStart && (
                    <span className="px-3 py-2 sm:py-1 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-center sm:text-left break-words">
                      HAFTA {new Date(program.weekStart).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                  {program.pdfUrl && (
                    <a href={program.pdfUrl} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#c4b5fd] touch-manipulation break-all">
                      DOSYA AC
                    </a>
                  )}
                </div>
              </div>
              {program.pdfUrl && isImageAsset(program.pdfUrl) && (
                <Image
                  src={program.pdfUrl}
                  alt={program.title}
                  width={800}
                  height={320}
                  className="mt-3 max-h-48 w-full max-w-full rounded-xl border border-white/10 object-contain"
                />
              )}
              {program.content && editProgramId !== program.id && (
                <p className="mt-3 text-[11px] text-gray-300 font-bold italic bg-black/20 border border-white/5 rounded-xl p-3 break-words whitespace-pre-wrap">
                  {program.content}
                </p>
              )}
              {editProgramId === program.id && (
                <form onSubmit={handleProgramEditSubmit} className="mt-4 space-y-3 border border-[#7c3aed]/20 rounded-xl p-4 bg-black/20 min-w-0 [&_input]:min-h-11 [&_input]:text-base [&_input]:sm:text-xs [&_textarea]:text-base [&_textarea]:sm:text-xs">
                  <p className="text-[10px] font-black uppercase text-[#c4b5fd] break-words">Program icerigi (dosya degismez; yeni dosya icin yeni kayit acin)</p>
                  <input
                    required
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white touch-manipulation"
                  />
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))}
                    rows={4}
                    className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-bold text-gray-200 touch-manipulation"
                  />
                  <input
                    type="date"
                    value={editForm.weekStart}
                    onChange={(e) => setEditForm((f) => ({ ...f, weekStart: e.target.value }))}
                    className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white touch-manipulation"
                  />
                  <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-[10px] font-black uppercase disabled:opacity-50 touch-manipulation"
                    >
                      {editSaving ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditProgramId(null)}
                      className="min-h-11 w-full sm:w-auto px-4 py-2 rounded-xl border border-white/15 text-[10px] font-black uppercase text-gray-300 touch-manipulation"
                    >
                      Vazgec
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
