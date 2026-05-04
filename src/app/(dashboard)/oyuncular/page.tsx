"use client";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import {
  Search,
  UserPlus,
  ChevronRight,
  Filter,
  Loader2,
  UserCircle,
  UserMinus,
  UserCheck,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { deactivateAthlete, hardDeleteAthlete, reactivateAthlete } from "@/lib/actions/playerActions";
import { listManagementDirectory } from "@/lib/actions/managementDirectoryActions";
import {
  assignAthleteToTeam,
  createTeamAction,
  listTeamsForActor,
  loadTeamDetail,
  removeAthleteFromTeam,
} from "@/lib/actions/teamActions";
import type { PlayerWithPayments } from "@/types/domain";
import Notification from "@/components/Notification";
import { profileRowIsActive } from "@/lib/coach/lifecycle";
import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";

type TeamListRow = { id: string; name: string; created_at: string };

type TeamWorkspaceDetail = {
  team: { id: string; name: string };
  athletes: Array<{
    id: string;
    fullName: string;
    email: string;
    number: string;
    position: string;
    isActive: boolean;
  }>;
  availableAthletes: Array<{ id: string; fullName: string }>;
  canManageTeamMembers: boolean;
  summary: {
    total: number;
    activeCount: number;
    inactiveCount: number;
    positionSummary: Record<string, number>;
  };
};

export default function OyuncuYonetimi() {
  const [players, setPlayers] = useState<PlayerWithPayments[]>([]);
  const [teamRegistry, setTeamRegistry] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<"athletes" | "teams" | "team-detail">("athletes");
  const [teamsList, setTeamsList] = useState<TeamListRow[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [newTeamNameInput, setNewTeamNameInput] = useState("");
  const [teamCreateBusy, setTeamCreateBusy] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamWorkspaceDetail | null>(null);
  const [teamDetailLoading, setTeamDetailLoading] = useState(false);
  const [athleteToAddId, setAthleteToAddId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("Tüm Takımlar");
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "active" | "inactive">("active");

  useEffect(() => {
    void fetchPlayers();
  }, []);

  // Mevcut takımları dinamik olarak çek (Filtre için)
  const availableTeams = useMemo(() => {
    const teams = new Set([
      ...players.map((p) => p.team).filter((team): team is string => typeof team === "string" && team.length > 0),
      ...teamRegistry,
    ]);
    return ["Tüm Takımlar", ...Array.from(teams)];
  }, [players, teamRegistry]);

  async function fetchPlayers() {
    setLoading(true);
    try {
      const [result, teamsResult] = await Promise.all([listManagementDirectory(), listTeamsForActor()]);
      if ("error" in result) {
        setPlayers([]);
        return;
      }
      setPlayers((result.athletes as PlayerWithPayments[]) || []);
      if (!("error" in teamsResult)) {
        setTeamRegistry((teamsResult.teams || []).map((t) => String(t.name)).filter(Boolean));
      }
    } catch (error) {
      console.error("Sporcular yuklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshTeamsList() {
    const teamsResult = await listTeamsForActor();
    if ("error" in teamsResult) {
      setTeamsList([]);
      setActionMessage(teamsResult.error ?? "Takımlar yüklenemedi.");
      return;
    }
    setTeamsList(
      (teamsResult.teams || []).map((t) => ({
        id: String(t.id),
        name: String(t.name || ""),
        created_at: String(t.created_at || ""),
      }))
    );
  }

  useEffect(() => {
    if (workspace !== "teams") return;
    let cancelled = false;
    void (async () => {
      setTeamsLoading(true);
      await refreshTeamsList();
      if (!cancelled) setTeamsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  async function openTeamDetail(teamId: string) {
    setActionMessage(null);
    setSelectedTeamId(teamId);
    setWorkspace("team-detail");
    setTeamDetail(null);
    setAthleteToAddId("");
    setTeamDetailLoading(true);
    const res = await loadTeamDetail(teamId);
    setTeamDetailLoading(false);
    if ("error" in res) {
      setActionMessage(res.error ?? "Takım detayı yüklenemedi.");
      setWorkspace("teams");
      setSelectedTeamId(null);
      return;
    }
    setTeamDetail(res as TeamWorkspaceDetail);
  }

  async function reloadTeamDetail() {
    if (!selectedTeamId) return;
    setTeamDetailLoading(true);
    const res = await loadTeamDetail(selectedTeamId);
    setTeamDetailLoading(false);
    if ("error" in res) {
      setActionMessage(res.error ?? "Takım detayı yenilenemedi.");
      return;
    }
    setTeamDetail(res as TeamWorkspaceDetail);
  }

  async function handleAssignAthlete() {
    if (!selectedTeamId || !athleteToAddId || assignBusy) return;
    setAssignBusy(true);
    setActionMessage(null);
    try {
      const res = await assignAthleteToTeam(selectedTeamId, athleteToAddId);
      if ("error" in res) {
        setActionMessage(res.error ?? "Sporcu takıma eklenemedi.");
        return;
      }
      setAthleteToAddId("");
      setActionMessage("Sporcu takıma eklendi.");
      await reloadTeamDetail();
      await fetchPlayers();
      await refreshTeamsList();
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleRemoveFromTeam(athleteId: string, athleteName: string) {
    if (!selectedTeamId || removeBusyId) return;
    if (!window.confirm(`“${athleteName}” adlı sporcuyu bu takımdan çıkarmak istiyor musunuz?`)) return;
    setRemoveBusyId(athleteId);
    setActionMessage(null);
    try {
      const res = await removeAthleteFromTeam(selectedTeamId, athleteId);
      if ("error" in res) {
        setActionMessage(res.error ?? "Sporcu takımdan çıkarılamadı.");
        return;
      }
      setActionMessage("Sporcu takımdan çıkarıldı.");
      await reloadTeamDetail();
      await fetchPlayers();
      await refreshTeamsList();
    } finally {
      setRemoveBusyId(null);
    }
  }

  async function handleCreateTeam() {
    const name = newTeamNameInput.trim();
    if (name.length < 2) {
      setActionMessage("Takım adı en az 2 karakter olmalıdır.");
      return;
    }
    setTeamCreateBusy(true);
    setActionMessage(null);
    try {
      const fd = new FormData();
      fd.set("name", name);
      const res = await createTeamAction(fd);
      if ("error" in res && res.error) {
        setActionMessage(res.error);
        return;
      }
      setNewTeamNameInput("");
      setActionMessage("Takım oluşturuldu.");
      await refreshTeamsList();
      await fetchPlayers();
    } finally {
      setTeamCreateBusy(false);
    }
  }

  const handleDeactivate = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} adli sporcuyu pasife almak istedigine emin misin? Hesap ve gecmis veriler korunur; sporcu panele erisemez.`
      )
    ) {
      return;
    }
    const result = await deactivateAthlete(id);
    if (result?.success) {
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: false } : p)));
      setActionMessage("Sporcu pasife alindi.");
    } else {
      setActionMessage("Islem hatasi: " + (result?.error || "Bilinmeyen hata"));
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    if (!confirm(`${name} adli sporcuyu tekrar aktif etmek istedigine emin misin?`)) return;
    const result = await reactivateAthlete(id);
    if (result?.success) {
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: true } : p)));
      setActionMessage("Sporcu tekrar aktif edildi.");
    } else {
      setActionMessage("Islem hatasi: " + (result?.error || "Bilinmeyen hata"));
    }
  };

  const handleHardDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `${name} adlı sporcuyu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`
      )
    ) {
      return;
    }
    const result = await hardDeleteAthlete(id);
    if (result?.success) {
      setPlayers((prev) => prev.filter((p) => p.id !== id));
      setActionMessage("Sporcu kalıcı olarak silindi.");
    } else {
      setActionMessage("Silme hatası: " + (result?.error || "Bilinmeyen hata"));
    }
  };

  const filteredPlayers = useMemo(() => {
    const rows = players.filter((player) => {
      const nameMatch = player.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTeam = selectedTeam === "Tüm Takımlar" || player.team === selectedTeam;
      const active = profileRowIsActive(player.is_active);
      const lifecycleOk =
        lifecycleFilter === "all" ||
        (lifecycleFilter === "active" && active) ||
        (lifecycleFilter === "inactive" && !active);
      return nameMatch && matchesTeam && lifecycleOk;
    });
    return [...rows].sort((a, b) => {
      const ac = profileRowIsActive(a.is_active) ? 0 : 1;
      const bc = profileRowIsActive(b.is_active) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return (a.full_name || "").localeCompare(b.full_name || "", "tr");
    });
  }, [players, searchTerm, selectedTeam, lifecycleFilter]);

  return (
    <div className="ui-page-loose animate-in fade-in duration-700 min-w-0 overflow-x-hidden pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="ui-h1">
            TAKIM <span className="text-[#7c3aed]">KADROSU</span>
          </h1>
          <p className="ui-lead break-words">
            Atletik Profil & Kadro Yönetimi
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setActionMessage(null);
                setSelectedTeamId(null);
                setTeamDetail(null);
                setWorkspace("teams");
              }}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/30 px-5 text-[10px] font-black uppercase tracking-wide text-gray-200 shadow-lg transition hover:border-[#7c3aed]/40 hover:bg-[#7c3aed]/10 hover:text-white sm:min-h-11 sm:w-auto"
            >
              <Users size={18} aria-hidden />
              Takım yönetimi
            </button>
          <Link
            href="/sporcular/yeni"
            className="ui-btn-primary w-full min-h-12 sm:w-auto sm:min-h-11 px-6 rounded-2xl inline-flex items-center justify-center gap-3 shadow-xl shadow-[#7c3aed]/20 touch-manipulation shrink-0"
          >
            <UserPlus size={20} /> YENİ SPORCU EKLE
          </Link>
        </div>
      </header>
      {actionMessage ? (
        <div className="min-w-0 break-words">
          <Notification
            message={actionMessage}
            variant={
              /hata|yok\.|yetki|geçersiz|bulunamadı|eklenemedi|çıkarılamadı|mevcut|reddedildi/i.test(actionMessage)
                ? "error"
                : "success"
            }
          />
        </div>
      ) : null}

      {workspace === "teams" ? (
        <section className="space-y-5 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-black uppercase tracking-tight text-white">Takım yönetimi</h2>
              <p className="mt-1 max-w-xl text-[11px] font-semibold leading-relaxed text-gray-500">
                Sporcuları takımlara ayırarak filtreleme ve organizasyonu kolaylaştırın.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActionMessage(null);
                setSelectedTeamId(null);
                setTeamDetail(null);
                setWorkspace("athletes");
              }}
              className="shrink-0 self-start rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-300 transition hover:border-white/25 hover:text-white"
            >
              Sporcu yönetimi ekranına dön
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-black uppercase text-gray-500">Yeni takım oluştur</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={newTeamNameInput}
                onChange={(e) => setNewTeamNameInput(e.target.value)}
                placeholder="Takım adı"
                maxLength={60}
                className="ui-input min-h-11 w-full flex-1 sm:max-w-md"
              />
              <button
                type="button"
                disabled={teamCreateBusy}
                onClick={() => void handleCreateTeam()}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed] px-5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg shadow-[#7c3aed]/25 transition hover:bg-[#6d28d9] disabled:opacity-50"
              >
                {teamCreateBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Takım oluştur
              </button>
            </div>
          </div>

          {teamsLoading ? (
            <div className="flex min-h-[20dvh] items-center justify-center py-12">
              <Loader2 className="size-8 animate-spin text-[#7c3aed]" aria-hidden />
            </div>
          ) : teamsList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-black/15 px-4 py-10 text-center">
              <p className="text-sm font-black text-gray-200">Henüz takım oluşturulmadı.</p>
              <p className="mt-1 text-[11px] font-semibold text-gray-500">İlk takımı oluşturarak başlayın.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 text-[10px] font-black uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Takım adı</th>
                    <th className="px-4 py-3 text-right">Sporcu sayısı</th>
                    <th className="px-4 py-3">Oluşturulma</th>
                    <th className="px-4 py-3 w-24 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {teamsList.map((t) => {
                    const athleteCount = players.filter((p) => (p.team || "").trim() === t.name).length;
                    const createdLabel = t.created_at
                      ? new Date(t.created_at).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "—";
                    return (
                      <tr
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => void openTeamDetail(t.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void openTeamDetail(t.id);
                          }
                        }}
                        className="cursor-pointer border-b border-white/5 text-xs text-gray-200 transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/40"
                      >
                        <td className="px-4 py-3 font-semibold text-white">{t.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{athleteCount}</td>
                        <td className="px-4 py-3 text-gray-400">{createdLabel}</td>
                        <td className="px-4 py-3 text-right text-[#7c3aed]">
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide">
                            Detay
                            <ChevronRight className="size-4" aria-hidden />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {workspace === "team-detail" && selectedTeamId ? (
        <section className="space-y-5 rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActionMessage(null);
                  setSelectedTeamId(null);
                  setTeamDetail(null);
                  setAthleteToAddId("");
                  setWorkspace("teams");
                }}
                className="mb-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:border-white/20 hover:text-white"
              >
                <ChevronRight className="size-3.5 rotate-180" aria-hidden />
                Takımlara dön
              </button>
              {teamDetailLoading && !teamDetail ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="size-5 animate-spin text-[#7c3aed]" aria-hidden />
                  <span className="text-[11px] font-semibold text-gray-500">Yükleniyor…</span>
                </div>
              ) : teamDetail ? (
                <>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">{teamDetail.team.name}</h2>
                  <p className="mt-1 text-[11px] font-semibold text-gray-500">
                    Takımdaki sporcu:{" "}
                    <span className="tabular-nums text-gray-300">{teamDetail.summary.total}</span>
                    {teamDetailLoading ? (
                      <span className="ml-2 inline-flex align-middle">
                        <Loader2 className="size-3.5 animate-spin text-[#7c3aed]" aria-hidden />
                      </span>
                    ) : null}
                  </p>
                </>
              ) : null}
            </div>
          </div>

          {!teamDetailLoading && teamDetail && !teamDetail.canManageTeamMembers ? (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100/90">
              Takım üyelerini düzenleme yetkiniz yok. Liste salt okunurdur.
            </p>
          ) : null}

          {teamDetail && teamDetail.canManageTeamMembers ? (
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[10px] font-black uppercase text-gray-500">Sporcu ekle</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={athleteToAddId}
                  onChange={(e) => setAthleteToAddId(e.target.value)}
                  disabled={assignBusy || teamDetailLoading}
                  className="ui-select min-h-11 w-full flex-1 sm:max-w-md"
                >
                  <option value="">
                    {teamDetail.availableAthletes.length === 0
                      ? "Eklenebilecek sporcu yok"
                      : "Sporcu seçin"}
                  </option>
                  {teamDetail.availableAthletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.fullName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={assignBusy || !athleteToAddId || teamDetailLoading}
                  onClick={() => void handleAssignAthlete()}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed] px-5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg shadow-[#7c3aed]/25 transition hover:bg-[#6d28d9] disabled:opacity-45"
                >
                  {assignBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Takıma ekle
                </button>
              </div>
            </div>
          ) : null}

          {teamDetail && !teamDetailLoading ? (
            teamDetail.athletes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/15 px-4 py-10 text-center">
                <p className="text-sm font-black text-gray-200">Bu takımda henüz sporcu yok.</p>
                <p className="mt-1 text-[11px] font-semibold text-gray-500">Yukarıdan sporcu ekleyerek başlayın.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-[10px] font-black uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Ad soyad</th>
                      <th className="px-4 py-3">E-posta</th>
                      <th className="px-4 py-3">Kategori</th>
                      <th className="px-4 py-3 text-right"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamDetail.athletes.map((a) => (
                      <tr key={a.id} className="border-b border-white/5 text-xs text-gray-200">
                        <td className="px-4 py-3 font-semibold text-white">{a.fullName}</td>
                        <td className="max-w-[12rem] truncate px-4 py-3 text-gray-400">{a.email}</td>
                        <td className="px-4 py-3 text-gray-400">{a.position}</td>
                        <td className="px-4 py-3 text-right">
                          {teamDetail.canManageTeamMembers ? (
                            <button
                              type="button"
                              disabled={removeBusyId === a.id || assignBusy}
                              onClick={() => void handleRemoveFromTeam(a.id, a.fullName)}
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-red-200 transition hover:bg-red-500/20 disabled:opacity-45"
                            >
                              {removeBusyId === a.id ? (
                                <Loader2 className="mx-auto size-3.5 animate-spin" aria-hidden />
                              ) : (
                                "Takımdan çıkar"
                              )}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </section>
      ) : null}

      {workspace === "athletes" ? (
      <>
      {/* ARAÇ ÇUBUĞU */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 ui-toolbar shadow-xl min-w-0">
        <div className="relative flex-1 min-w-0 group">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-[#7c3aed] sm:left-6" aria-hidden />
          <input 
            type="search" 
            placeholder="KADRODA ARA..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="ui-input pl-12 sm:pl-16 text-base sm:text-[11px] italic uppercase tracking-wide sm:tracking-widest touch-manipulation"
          />
        </div>
        <div className="relative w-full min-w-0 md:min-w-[200px] md:w-auto md:max-w-[280px]">
          <select 
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="ui-select w-full px-6 sm:px-8 text-base sm:text-[11px] italic uppercase appearance-none cursor-pointer pr-12 sm:pr-14 touch-manipulation min-h-11"
          >
            {availableTeams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          <Filter size={16} className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[#7c3aed]" aria-hidden />
        </div>
        <div className="relative w-full min-w-0 md:min-w-[200px] md:w-auto md:max-w-[240px]">
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value as "all" | "active" | "inactive")}
            className="ui-select w-full px-6 sm:px-8 text-base sm:text-[11px] italic uppercase appearance-none cursor-pointer pr-12 sm:pr-14 touch-manipulation min-h-11"
          >
            <option value="active">Aktif sporcular</option>
            <option value="inactive">Pasif sporcular</option>
            <option value="all">Tumu</option>
          </select>
          <Filter size={16} className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[#7c3aed]" aria-hidden />
        </div>
      </div>

      {/* SPORCU KARTLARI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        {loading ? (
          <div className="col-span-full flex min-h-[35dvh] min-w-0 flex-col items-center justify-center py-20 sm:py-40">
            <Loader2 className="mb-6 animate-spin text-[#7c3aed]" size={48} aria-hidden />
            <p className="animate-pulse text-center text-xs font-black uppercase italic tracking-widest text-gray-500">Kadro Yükleniyor...</p>
          </div>
        ) : filteredPlayers.length > 0 ? (
          filteredPlayers.map(player => (
            <div key={player.id} className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[2rem] border border-white/5 bg-[#121215] p-5 shadow-xl transition-all sm:rounded-[3rem] sm:p-6 sm:hover:border-[#7c3aed]/40">
              {profileRowIsActive(player.is_active) ? (
                <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-20 flex items-center gap-2 opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    title="Kalıcı sil"
                    onClick={(e) => {
                      e.preventDefault();
                      void handleHardDelete(player.id, player.full_name || "Sporcu");
                    }}
                    className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-red-500/10 p-0 text-red-400 transition-all sm:hover:bg-red-500 sm:hover:text-white"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    title="Pasife al"
                    onClick={(e) => {
                      e.preventDefault();
                      void handleDeactivate(player.id, player.full_name || "Sporcu");
                    }}
                    className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-amber-500/10 p-0 text-amber-400 transition-all sm:hover:bg-amber-500 sm:hover:text-black"
                  >
                    <UserMinus size={16} aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="absolute top-4 right-4 sm:top-8 sm:right-8 z-20 flex items-center gap-2 opacity-100 transition-all md:opacity-0 md:group-hover:opacity-100">
                  <button
                    type="button"
                    title="Kalıcı sil"
                    onClick={(e) => {
                      e.preventDefault();
                      void handleHardDelete(player.id, player.full_name || "Sporcu");
                    }}
                    className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-red-500/10 p-0 text-red-400 transition-all sm:hover:bg-red-500 sm:hover:text-white"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                  <button
                    type="button"
                    title="Tekrar aktif et"
                    onClick={(e) => {
                      e.preventDefault();
                      void handleReactivate(player.id, player.full_name || "Sporcu");
                    }}
                    className="min-h-11 min-w-11 inline-flex touch-manipulation items-center justify-center rounded-xl bg-emerald-500/10 p-0 text-emerald-400 transition-all sm:hover:bg-emerald-500 sm:hover:text-black"
                  >
                    <UserCheck size={16} aria-hidden />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-5 mb-6 min-w-0">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-[#7c3aed]/10 bg-[#1c1c21] font-black text-2xl italic text-[#7c3aed] shadow-inner transition-all sm:group-hover:border-[#7c3aed]">
                   {player.avatar_url ? (
                     <Image
                       src={player.avatar_url}
                       className="w-full h-full object-cover"
                       alt=""
                       width={64}
                       height={64}
                     />
                   ) : (
                     <span className="uppercase">{player.full_name?.[0]}</span>
                   )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-black italic text-white uppercase tracking-tighter leading-tight mb-2 sm:group-hover:text-[#7c3aed] transition-colors break-words pr-12 md:pr-0">
                    {player.full_name}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest italic flex items-center gap-2 flex-wrap">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${profileRowIsActive(player.is_active) ? "bg-green-500" : "bg-amber-500"}`}
                    />
                    <span className={profileRowIsActive(player.is_active) ? "ui-badge-success !px-2 !py-0.5 !text-[9px] !bg-emerald-500/5 !border-emerald-500/20 text-gray-400" : "ui-badge-warning !px-2 !py-0.5 !text-[9px]"}>
                      {profileRowIsActive(player.is_active) ? "Aktif" : "Pasif"}
                    </span>
                    <span className="text-gray-600">•</span>
                    {player.position || 'GELİŞİM'} • #{player.number || '00'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-[#1c1c21]/50 p-5 rounded-[2rem] border border-white/5 text-center">
                  <p className="text-[8px] text-gray-600 font-black uppercase mb-1 tracking-widest italic">BOY / KİLO</p>
                  <p className="text-xs font-black text-gray-300 italic leading-none">{player.height || '0'}cm / {player.weight || '0'}kg</p>
                </div>
                <div className="bg-[#1c1c21]/50 p-5 rounded-[2rem] border border-white/5 text-center">
                  <p className="text-[8px] text-gray-600 font-black uppercase mb-1 tracking-widest italic">KATEGORİ</p>
                  <p className="text-[9px] font-black text-[#7c3aed] italic uppercase break-words">{player.team || 'GENEL'}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-[10px] font-bold">
                <p className="text-gray-500">Aktif paket</p>
                <p className="text-right text-white">{player.activePackageName || "Yok"}</p>
                <p className="text-gray-500">Kalan ders</p>
                <p className="text-right text-white tabular-nums">{player.remainingLessons ?? "—"}</p>
                <p className="text-gray-500">Finans durumu</p>
                <div className="text-right">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getFinanceStatusPresentation(player.financeSummary).badgeClass}`}>
                    {getFinanceStatusPresentation(player.financeSummary).label}
                  </span>
                </div>
                <p className="text-gray-500">Son ders</p>
                <p className="text-right text-white">{player.lastLessonAt ? new Date(player.lastLessonAt).toLocaleDateString("tr-TR") : "—"}</p>
              </div>

              <Link href={`/sporcu/${player.id}`} className="mt-auto touch-manipulation">
                <span className="ui-btn-ghost inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl text-[9px] uppercase tracking-[0.2em] shadow-xl sm:min-h-11 sm:tracking-[0.3em] sm:hover:bg-[#7c3aed] sm:hover:text-white">
                  PROFİLİ İNCELE <ChevronRight size={14} aria-hidden />
                </span>
              </Link>
            </div>
          ))
        ) : (
          <div className="col-span-full rounded-[2rem] border-4 border-dashed border-white/5 py-16 text-center sm:rounded-[4rem] sm:py-32">
            <UserCircle size={48} className="mx-auto mb-4 text-gray-800" aria-hidden />
            <p className="text-gray-600 font-black italic uppercase tracking-widest text-xs">Sonuç bulunamadı veya kadro henüz boş.</p>
          </div>
        )}
      </div>
      </>
      ) : null}

    </div>
  );
}