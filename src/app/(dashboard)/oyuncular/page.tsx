"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  UserPlus,
  Filter,
  Users,
} from "lucide-react";
import Link from "next/link";
import { deactivateAthlete, hardDeleteAthlete, reactivateAthlete } from "@/lib/actions/playerActions";
import { listManagementDirectory, type ManagementDirectorySuccess } from "@/lib/actions/managementDirectoryActions";
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
import { AthleteCard } from "./_components/AthleteCard";
import { TeamsListPanel, type TeamRow } from "./_components/TeamsListPanel";
import { TeamDetailPanel, type TeamDetailWorkspace } from "./_components/TeamDetailPanel";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCard } from "@/components/ui/skeletons";
import { DIRECTORY_DEFAULT_PAGE_SIZE } from "@/lib/management/directoryPagination";

export default function OyuncuYonetimi() {
  const [players, setPlayers] = useState<PlayerWithPayments[]>([]);
  const [teamRegistry, setTeamRegistry] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<"athletes" | "teams" | "team-detail">("athletes");
  const [teamsList, setTeamsList] = useState<TeamRow[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [newTeamNameInput, setNewTeamNameInput] = useState("");
  const [teamCreateBusy, setTeamCreateBusy] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetailWorkspace | null>(null);
  const [teamDetailLoading, setTeamDetailLoading] = useState(false);
  const [athleteToAddId, setAthleteToAddId] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [removeBusyId, setRemoveBusyId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("Tüm Takımlar");
  const [lifecycleFilter, setLifecycleFilter] = useState<"all" | "active" | "inactive">("active");
  const [page, setPage] = useState(1);
  const [totalAthletes, setTotalAthletes] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [teamAthleteCounts, setTeamAthleteCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedTeam, lifecycleFilter]);

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    try {
      const [result, teamsResult] = await Promise.all([
        listManagementDirectory({
          view: "full",
          page,
          pageSize: DIRECTORY_DEFAULT_PAGE_SIZE,
          search: debouncedSearch || undefined,
          team: selectedTeam,
          lifecycle: lifecycleFilter,
        }),
        listTeamsForActor(),
      ]);
      if ("error" in result && result.error) {
        setPlayers([]);
        return;
      }
      const directory = result as ManagementDirectorySuccess;
      setPlayers((directory.athletes as PlayerWithPayments[]) || []);
      setTotalAthletes(directory.totalAthletes ?? directory.athletes.length);
      setTotalPages(directory.totalPages ?? 1);
      if (!("error" in teamsResult)) {
        setTeamRegistry((teamsResult.teams || []).map((t) => String(t.name)).filter(Boolean));
      }
    } catch (error) {
      console.error("Sporcular yuklenirken hata:", error);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedTeam, lifecycleFilter]);

  useEffect(() => {
    void fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    if (workspace !== "teams") return;
    let cancelled = false;
    void (async () => {
      const summary = await listManagementDirectory({ view: "summary" });
      if (cancelled || "error" in summary) return;
      const counts: Record<string, number> = {};
      for (const athlete of summary.athletes) {
        const teamName = (athlete.team || "").trim();
        if (!teamName) continue;
        counts[teamName] = (counts[teamName] ?? 0) + 1;
      }
      setTeamAthleteCounts(counts);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace, players]);

  const availableTeams = useMemo(() => {
    const teams = new Set(teamRegistry);
    return ["Tüm Takımlar", ...Array.from(teams)];
  }, [teamRegistry]);

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
    setTeamDetail(res as TeamDetailWorkspace);
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
    setTeamDetail(res as TeamDetailWorkspace);
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

  const displayedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => {
        const ac = profileRowIsActive(a.is_active) ? 0 : 1;
        const bc = profileRowIsActive(b.is_active) ? 0 : 1;
        if (ac !== bc) return ac - bc;
        return (a.full_name || "").localeCompare(b.full_name || "", "tr");
      }),
    [players]
  );

  return (
    <div className="ui-page-loose animate-in fade-in duration-700 min-w-0 overflow-x-hidden pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="ui-h1">
            TAKIM <span className="text-[color:var(--peaker-ui-PRIMARY)]">KADROSU</span>
          </h1>
          <p className="ui-lead break-words">Atletik Profil & Kadro Yönetimi</p>
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
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl ui-btn-ghost px-5 text-[10px] font-black uppercase tracking-wide text-gray-200 shadow-lg transition hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_10%,transparent)] hover:text-white sm:min-h-11 sm:w-auto"
          >
            <Users size={18} aria-hidden />
            Takım yönetimi
          </button>
          <Link
            href="/sporcular/yeni"
            className="ui-btn-primary w-full min-h-12 sm:w-auto sm:min-h-11 px-6 rounded-2xl inline-flex items-center justify-center gap-3 shadow-xl shadow-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)] touch-manipulation shrink-0"
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
        <TeamsListPanel
          teamsList={teamsList}
          teamsLoading={teamsLoading}
          teamAthleteCounts={teamAthleteCounts}
          newTeamNameInput={newTeamNameInput}
          setNewTeamNameInput={setNewTeamNameInput}
          teamCreateBusy={teamCreateBusy}
          onCreateTeam={() => void handleCreateTeam()}
          onOpenTeamDetail={(id) => void openTeamDetail(id)}
          onBackToAthletes={() => {
            setActionMessage(null);
            setSelectedTeamId(null);
            setTeamDetail(null);
            setWorkspace("athletes");
          }}
        />
      ) : null}

      {workspace === "team-detail" && selectedTeamId ? (
        <TeamDetailPanel
          teamDetail={teamDetail}
          teamDetailLoading={teamDetailLoading}
          athleteToAddId={athleteToAddId}
          setAthleteToAddId={setAthleteToAddId}
          assignBusy={assignBusy}
          removeBusyId={removeBusyId}
          onAssignAthlete={() => void handleAssignAthlete()}
          onRemoveAthlete={(id, name) => void handleRemoveFromTeam(id, name)}
          onBackToTeams={() => {
            setActionMessage(null);
            setSelectedTeamId(null);
            setTeamDetail(null);
            setAthleteToAddId("");
            setWorkspace("teams");
          }}
        />
      ) : null}

      {workspace === "athletes" ? (
        <>
          {/* ARAÇ ÇUBUĞU */}
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 ui-toolbar shadow-xl min-w-0">
            <div className="relative flex-1 min-w-0 group">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-[color:var(--peaker-ui-PRIMARY)] sm:left-6"
                aria-hidden
              />
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
                {availableTeams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
              <Filter
                size={16}
                className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[color:var(--peaker-ui-PRIMARY)]"
                aria-hidden
              />
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
              <Filter
                size={16}
                className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[color:var(--peaker-ui-PRIMARY)]"
                aria-hidden
              />
            </div>
          </div>

          {/* SPORCU KARTLARI */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
            {loading ? (
              <>
                <SkeletonCard rows={4} />
                <SkeletonCard rows={4} />
                <SkeletonCard rows={4} />
              </>
            ) : displayedPlayers.length > 0 ? (
              displayedPlayers.map((player) => (
                <AthleteCard
                  key={player.id}
                  player={player}
                  onDeactivate={handleDeactivate}
                  onReactivate={handleReactivate}
                  onHardDelete={handleHardDelete}
                />
              ))
            ) : totalAthletes === 0 && !debouncedSearch && selectedTeam === "Tüm Takımlar" && lifecycleFilter === "active" ? (
              <div className="col-span-full">
                <EmptyState
                  variant="onboarding"
                  title="İlk sporcunu ekle"
                  description="Sporcu kadron henüz boş. Yeni sporcu ekleyerek antrenman, finans ve performans takibini başlatabilirsin."
                  reason="Sporcu eklendikten sonra ders programı, ödeme ve saha testi akışları aktifleşir."
                  primaryAction={{ label: "Yeni sporcu ekle", href: "/sporcular/yeni" }}
                  secondaryAction={{ label: "Takım oluştur", onClick: () => setWorkspace("teams") }}
                />
              </div>
            ) : (
              <div className="col-span-full">
                <EmptyState
                  variant="filtered_empty"
                  description="Seçili filtre/aramayla eşleşen sporcu bulunamadı. Filtreleri sıfırlayarak tekrar deneyin."
                  primaryAction={{
                    label: "Filtreleri sıfırla",
                    onClick: () => {
                      setSearchTerm("");
                      setSelectedTeam("Tüm Takımlar");
                      setLifecycleFilter("active");
                    },
                  }}
                />
              </div>
            )}
          </div>

          {!loading && totalPages > 1 ? (
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {totalAthletes} sporcu · sayfa {page}/{totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-10 rounded-xl ui-kpi-band px-4 text-[10px] font-black uppercase tracking-wide text-gray-300 disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-10 rounded-xl ui-kpi-band px-4 text-[10px] font-black uppercase tracking-wide text-gray-300 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
