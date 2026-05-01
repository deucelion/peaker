"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Plus, Search, Paperclip, Filter } from "lucide-react";
import Notification from "@/components/Notification";
import EmptyStateCard from "@/components/EmptyStateCard";
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
  const [athleteSearch, setAthleteSearch] = useState("");
  const [coachFilter, setCoachFilter] = useState("");
  const [weekFilter, setWeekFilter] = useState("");
  const [fileFilter, setFileFilter] = useState<"all" | "with_file" | "without_file">("all");
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

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) => a.full_name.toLowerCase().includes(q));
  }, [athletes, athleteSearch]);

  const selectedAthleteCount = selectedAthletes.length;

  const selectedAthletesSet = useMemo(() => new Set(selectedAthletes), [selectedAthletes]);
  const areAllFilteredAthletesSelected =
    filteredAthletes.length > 0 && filteredAthletes.every((a) => selectedAthletesSet.has(a.id));

  const thisWeekAssignedCount = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const mondayEnd = new Date(monday);
    mondayEnd.setDate(mondayEnd.getDate() + 7);
    return programs.filter((p) => {
      if (!p.weekStart) return false;
      const week = new Date(p.weekStart);
      return week.getTime() >= monday.getTime() && week.getTime() < mondayEnd.getTime();
    }).length;
  }, [programs]);

  const programsWithFileCount = useMemo(
    () => programs.filter((p) => Boolean(p.pdfUrl)).length,
    [programs]
  );

  const filteredPrograms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter((p) => {
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.athleteName.toLowerCase().includes(q) ||
        p.coachName.toLowerCase().includes(q);
      const matchesCoach = !coachFilter || p.coachId === coachFilter;
      const matchesWeek = !weekFilter || (p.weekStart ? p.weekStart.slice(0, 10) === weekFilter : false);
      const hasFile = Boolean(p.pdfUrl);
      const matchesFileFilter =
        fileFilter === "all" ||
        (fileFilter === "with_file" && hasFile) ||
        (fileFilter === "without_file" && !hasFile);
      return matchesSearch && matchesCoach && matchesWeek && matchesFileFilter;
    });
  }, [programs, search, coachFilter, weekFilter, fileFilter]);

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
            PROGRAM & <span className="text-[#7c3aed]">NOT YÖNETİMİ</span>
          </h1>
          <p className="text-gray-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.2em] sm:tracking-[0.3em] italic mt-2 sm:mt-3 border-l-2 border-[#7c3aed] pl-3 sm:pl-4 break-words">
            Koç notu ve haftalık program çalışma alanı
          </p>
        </div>
        <div className="relative w-full md:w-72 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" size={16} aria-hidden />
          <input
            type="search"
            autoComplete="off"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Program ara..."
            className="w-full min-h-11 bg-[#121215] border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-base sm:text-xs font-black italic uppercase text-white outline-none focus:border-[#7c3aed]/50 touch-manipulation"
          />
        </div>
      </header>

      {!error ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-white/10 bg-[#121215] px-3 py-3">
            <p className="text-[9px] font-black uppercase text-gray-500">Toplam Program</p>
            <p className="mt-1 text-lg font-black text-white">{programs.length}</p>
          </div>
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-3">
            <p className="text-[9px] font-black uppercase text-indigo-200">Bu Hafta Atanan</p>
            <p className="mt-1 text-lg font-black text-white">{thisWeekAssignedCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
            <p className="text-[9px] font-black uppercase text-emerald-200">Aktif Sporcu</p>
            <p className="mt-1 text-lg font-black text-white">{athletes.length}</p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
            <p className="text-[9px] font-black uppercase text-amber-200">Dosyalı Program</p>
            <p className="mt-1 text-lg font-black text-white">{programsWithFileCount}</p>
          </div>
        </section>
      ) : null}

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
          className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-5 min-w-0"
        >
          <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2 break-words">
            <Plus size={16} className="text-[#7c3aed] shrink-0" aria-hidden /> Yeni Program / Not
          </h3>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#c4b5fd]">Program Bilgisi</p>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-black uppercase">Başlık</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Örn. Haftalık kuvvet ve hız planı"
                  className="w-full min-h-11 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-bold text-white outline-none focus:border-[#7c3aed]/60"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-black uppercase">Hafta Başlangıcı</label>
                <input
                  type="date"
                  value={form.weekStart}
                  onChange={(e) => setForm((p) => ({ ...p, weekStart: e.target.value }))}
                  className="w-full min-h-11 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-bold text-white outline-none focus:border-[#7c3aed]/60"
                />
              </div>
              {role === "admin" ? (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-black uppercase">Koç</label>
                  <select
                    value={form.coachId}
                    onChange={(e) => setForm((p) => ({ ...p, coachId: e.target.value }))}
                    className="w-full min-h-11 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-bold text-white outline-none focus:border-[#7c3aed]/60"
                  >
                    {coaches.length === 0 && <option value="">Koç bulunamadı</option>}
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-black uppercase">Koç</label>
                  <input
                    value="Koç: Ben"
                    readOnly
                    className="w-full min-h-11 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-gray-400"
                  />
                </div>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#c4b5fd]">Sporcu Seçimi</p>
                <span className="text-[10px] font-black text-gray-400">{selectedAthleteCount} seçili</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} aria-hidden />
                  <input
                    type="search"
                    value={athleteSearch}
                    onChange={(e) => setAthleteSearch(e.target.value)}
                    placeholder="Sporcu ara..."
                    className="w-full min-h-10 bg-[#17171f] border border-white/10 rounded-xl pl-9 pr-3 text-sm font-semibold text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedAthletes((prev) => {
                      if (areAllFilteredAthletesSelected) {
                        return prev.filter((id) => !filteredAthletes.some((a) => a.id === id));
                      }
                      const merged = new Set(prev);
                      filteredAthletes.forEach((a) => merged.add(a.id));
                      return Array.from(merged);
                    })
                  }
                  className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-200"
                >
                  {areAllFilteredAthletesSelected ? "Seçimi Kaldır" : "Tümünü Seç"}
                </button>
              </div>
              <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredAthletes.map((athlete) => {
                  const checked = selectedAthletesSet.has(athlete.id);
                  return (
                    <label
                      key={athlete.id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold cursor-pointer ${
                        checked
                          ? "border-[#7c3aed]/40 bg-[#7c3aed]/15 text-white"
                          : "border-white/10 bg-black/20 text-gray-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedAthletes((prev) =>
                            e.target.checked ? [...prev, athlete.id] : prev.filter((id) => id !== athlete.id)
                          )
                        }
                      />
                      <span className="truncate">{athlete.full_name}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#c4b5fd]">Koç Notu / Haftalık Odak</p>
            <textarea
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="Bu haftanın hedefi, dikkat edilecek noktalar, yüklenme notları..."
              rows={4}
              className="w-full min-h-28 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-semibold text-white outline-none focus:border-[#7c3aed]/60"
            />
          </section>

          <section className="rounded-xl border border-dashed border-white/20 bg-black/20 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Paperclip size={16} className="text-[#c4b5fd]" aria-hidden />
              <p className="text-[10px] font-black uppercase tracking-wider text-[#c4b5fd]">Dosya Ekle</p>
            </div>
            <label className="block rounded-xl border border-white/10 bg-[#1c1c21] px-4 py-4 cursor-pointer">
              <p className="text-[11px] font-semibold text-gray-300">Dosyayı sürükleyin veya seçmek için tıklayın</p>
              <p className="mt-1 text-[10px] font-bold text-gray-500">Kabul edilen formatlar: PDF, PNG, JPG, JPEG, WEBP · Maksimum 10MB</p>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            <p className="text-[11px] font-semibold text-gray-400">
              {attachment ? `Seçili dosya: ${attachment.name}` : "Henüz dosya seçilmedi."}
            </p>
          </section>

          <button
            type="submit"
            disabled={
              saving ||
              selectedAthletes.length === 0 ||
              (role === "admin" && coaches.length === 0) ||
              (role === "coach" && !permissions.can_manage_training_notes)
            }
            className="min-h-11 w-full sm:w-auto px-6 py-3 rounded-xl bg-[#7c3aed] sm:hover:bg-[#6d28d9] text-white text-[10px] font-black uppercase tracking-wide sm:tracking-widest disabled:opacity-60 touch-manipulation"
          >
            {saving ? "Program kaydediliyor..." : "Programı Ekle"}
          </button>
        </form>
      )}

      {!error ? (
        <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2">
              <FileText size={16} className="text-[#7c3aed]" aria-hidden /> Mevcut Programlar
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
              <Filter size={14} aria-hidden />
              {filteredPrograms.length} kayıt
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <select
              value={coachFilter}
              onChange={(e) => setCoachFilter(e.target.value)}
              className="min-h-10 rounded-xl border border-white/10 bg-[#17171f] px-3 text-sm font-semibold text-white"
            >
              <option value="">Tüm koçlar</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.full_name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              className="min-h-10 rounded-xl border border-white/10 bg-[#17171f] px-3 text-sm font-semibold text-white"
            />
            <select
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value as "all" | "with_file" | "without_file")}
              className="min-h-10 rounded-xl border border-white/10 bg-[#17171f] px-3 text-sm font-semibold text-white"
            >
              <option value="all">Dosya: Tümü</option>
              <option value="with_file">Dosyalı</option>
              <option value="without_file">Dosyasız</option>
            </select>
          </div>
        </section>
      ) : null}

      {!error && filteredPrograms.length === 0 && (
        <div className="p-10 sm:p-16 text-center bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] min-w-0">
          <FileText size={40} className="mx-auto text-gray-700 mb-4" aria-hidden />
          <EmptyStateCard
            title="Kayıt bulunamadı"
            description="Seçili filtrelere uygun program kaydı görünmüyor."
            reason="Koç, hafta veya dosya filtresi çok dar kalmış olabilir."
            primaryAction={{
              label: "Filtreleri sıfırla",
              onClick: () => {
                setCoachFilter("");
                setWeekFilter("");
                setFileFilter("all");
                setSearch("");
              },
            }}
            secondaryAction={{ label: "Yeni program oluştur", onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) }}
            compact
          />
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
                    Hafta: {program.weekStart ? new Date(program.weekStart).toLocaleDateString("tr-TR") : "Belirtilmedi"} · Koç: {program.coachName}
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">
                    Atanan sporcu sayısı: 1 · Oluşturulma: {new Date(program.createdAt).toLocaleString("tr-TR")}
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
                      Detayı Aç / Görüntüle
                    </button>
                  )}
                  {program.pdfUrl && (
                    <a href={program.pdfUrl} target="_blank" rel="noreferrer" className="min-h-11 inline-flex items-center justify-center px-3 py-2 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#c4b5fd] touch-manipulation break-all">
                      Dosya Var
                    </a>
                  )}
                  {!program.pdfUrl ? (
                    <span className="px-3 py-2 sm:py-1 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-center sm:text-left break-words">
                      Dosya Yok
                    </span>
                  ) : null}
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
