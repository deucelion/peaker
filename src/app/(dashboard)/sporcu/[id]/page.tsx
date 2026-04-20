"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Heart,
  ChevronLeft,
  Target,
  ShieldCheck,
  Activity,
  Droplets,
  TrendingUp,
  Loader2,
  CreditCard,
  ClipboardList,
  BarChart2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ProfileBasic } from "@/types/domain";
import type { TrainingLoadRow, WellnessReportRow } from "@/types/performance";
import {
  listPositionOptionsForManagement,
  loadAthleteDetailForManagement,
  updateAthleteProfileForManagement,
} from "@/lib/actions/athleteDetailActions";
import {
  createAthleteInjuryNote,
  deactivateAthleteInjuryNote,
  listAthleteInjuryNotesForManagement,
} from "@/lib/actions/injuryNoteActions";
import { listTeamsForActor } from "@/lib/actions/teamActions";
import { AthleteFieldTestsPanel, type FieldTestResultRow } from "./AthleteFieldTestsPanel";
import { AthletePerformanceInsightsPanel, type BodyMetricRow } from "./AthletePerformanceInsightsPanel";
import Notification from "@/components/Notification";
import type { AthleteInjuryNoteRecord } from "@/lib/types";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
type TimelineEvent = { id: string; type: "lesson" | "payment" | "injury" | "note"; at: string; title: string; detail: string };

interface RadarPoint {
  subject: string;
  A: number;
  fullMark: number;
}

interface WeeklyLoadPoint {
  date: string;
  yuk: number;
}

export default function SporcuDetayDinamik() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<ProfileBasic | null>(null);
  const [radarData, setRadarData] = useState<RadarPoint[]>([]);
  const [tableMetrics, setTableMetrics] = useState<FieldTestResultRow[]>([]);
  const [wellnessReports, setWellnessReports] = useState<WellnessReportRow[]>([]);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricRow[]>([]);
  const [acwrStatus, setAcwrStatus] = useState({ ratio: 0, label: "Veri Bekleniyor", color: "text-gray-500" });
  const [weeklyLoads, setWeeklyLoads] = useState<WeeklyLoadPoint[]>([]);
  const [trainingLoads, setTrainingLoads] = useState<TrainingLoadRow[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [profileDraft, setProfileDraft] = useState({
    fullName: "",
    team: "",
    position: "",
    number: "",
    height: "",
    weight: "",
  });
  const [positionMessage, setPositionMessage] = useState<string | null>(null);
  const [updatingPosition, setUpdatingPosition] = useState(false);
  const [injuryNotes, setInjuryNotes] = useState<AthleteInjuryNoteRecord[]>([]);
  const [injuryType, setInjuryType] = useState("");
  const [injuryNoteText, setInjuryNoteText] = useState("");
  const [injuryImages, setInjuryImages] = useState<File[]>([]);
  const [injurySaving, setInjurySaving] = useState(false);
  const [injuryMessage, setInjuryMessage] = useState<string | null>(null);
  const [deactivatingInjuryId, setDeactivatingInjuryId] = useState<string | null>(null);
  const [financePackage, setFinancePackage] = useState<{
    activePackageName: string | null;
    remainingLessons: number | null;
    paymentStatus: string | null;
    packageSummary: { totalLessons: number; usedLessons: number; totalPrice: number; amountPaid: number } | null;
  } | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  const latestWellness = useMemo(() => {
    if (!wellnessReports.length) return null;
    return [...wellnessReports].sort(
      (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
    )[0];
  }, [wellnessReports]);

  const activeInjuryCount = useMemo(
    () => injuryNotes.filter((n) => n.isActive).length,
    [injuryNotes]
  );

  const localizedPaymentStatus = useMemo(() => {
    const raw = (financePackage?.paymentStatus || "").trim().toLowerCase();
    if (!raw) return "—";
    if (["paid", "odendi", "ödendi"].includes(raw)) return "Ödendi";
    if (["partial", "partially_paid", "kısmi", "kismi"].includes(raw)) return "Kısmi ödendi";
    if (["unpaid", "beklemede"].includes(raw)) return "Beklemede";
    if (["overdue", "gecikmis", "gecikmiş"].includes(raw)) return "Gecikmiş";
    return financePackage?.paymentStatus || "—";
  }, [financePackage?.paymentStatus]);

  const hasProfileDraftChanges = useMemo(() => {
    if (!player) return false;
    const normalize = (v: unknown) => String(v ?? "").trim();
    return (
      normalize(profileDraft.fullName) !== normalize(player.full_name) ||
      normalize(profileDraft.team) !== normalize(player.team) ||
      normalize(profileDraft.position) !== normalize(player.position) ||
      normalize(profileDraft.number) !== normalize(player.number) ||
      normalize(profileDraft.height) !== normalize(player.height) ||
      normalize(profileDraft.weight) !== normalize(player.weight)
    );
  }, [player, profileDraft]);

  useUnsavedChangesGuard({ enabled: hasProfileDraftChanges && !updatingPosition });

  const priorityCue = useMemo((): { text: string; wrapClass: string; textClass: string } => {
    if (acwrStatus.label === "YÜKSEK RİSK") {
      return {
        text: "ACWR yüksek risk bandında. Hacmi ve dinlenmeyi birlikte değerlendirin.",
        wrapClass: "border-red-500/30 bg-red-500/10",
        textClass: "text-red-200",
      };
    }
    if (activeInjuryCount > 0) {
      return {
        text: `Aktif sakatlık kaydı: ${activeInjuryCount}. Antrenman yükü ve programı buna göre güncel tutun.`,
        wrapClass: "border-amber-500/30 bg-amber-500/10",
        textClass: "text-amber-200",
      };
    }
    if (acwrStatus.label === "YORGUN") {
      return {
        text: "Sporcu yorgunluk bandında (ACWR). Birkaç gün daha muhafazakâr ilerleyin.",
        wrapClass: "border-amber-500/25 bg-amber-500/5",
        textClass: "text-amber-200",
      };
    }
    if (trainingLoads.length === 0) {
      return {
        text: "Antrenman yükü kaydı yok. Önce düzenli yük girişi sağlayın.",
        wrapClass: "border-white/10 bg-white/[0.04]",
        textClass: "text-gray-300",
      };
    }
    if (!latestWellness) {
      return {
        text: "Son wellness raporu görünmüyor. Sabah raporu akışını kontrol edin.",
        wrapClass: "border-white/10 bg-white/[0.04]",
        textClass: "text-gray-300",
      };
    }
    return {
      text: "Belirgin kritik uyarı yok. Finans, program ve raporları rutin takip edin.",
      wrapClass: "border-emerald-500/25 bg-emerald-500/5",
      textClass: "text-emerald-200",
    };
  }, [acwrStatus.label, activeInjuryCount, latestWellness, trainingLoads.length]);

  const calculateACWR = useCallback((loads: TrainingLoadRow[]) => {
    const last7Days = loads.slice(-7).reduce((acc, curr) => acc + (curr.total_load || 0), 0) / 7;
    const last28Days = loads.slice(-28).reduce((acc, curr) => acc + (curr.total_load || 0), 0) / 28;
    const ratio = last28Days > 0 ? last7Days / last28Days : 0;

    let status = { ratio: parseFloat(ratio.toFixed(2)), label: "STABİL", color: "text-green-500" };
    if (ratio > 1.5) status = { ratio: parseFloat(ratio.toFixed(2)), label: "YÜKSEK RİSK", color: "text-red-500" };
    else if (ratio > 1.3) status = { ratio: parseFloat(ratio.toFixed(2)), label: "YORGUN", color: "text-yellow-500" };
    else if (ratio < 0.8 && ratio > 0) status = { ratio: parseFloat(ratio.toFixed(2)), label: "DÜŞÜK YÜK", color: "text-blue-500" };

    setAcwrStatus(status);
  }, []);

  const loadInjuryNotes = useCallback(async (athleteId: string) => {
    const notesRes = await listAthleteInjuryNotesForManagement(athleteId);
    if ("error" in notesRes) {
      setInjuryMessage(notesRes.error || "Sakatlık geçmişi alınamadı.");
      setInjuryNotes([]);
      return;
    }
    setInjuryNotes(notesRes.notes || []);
  }, []);

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      router.push("/oyuncular");
      return;
    }
    setLoading(true);
    try {
      const res = await loadAthleteDetailForManagement(id);
      if ("error" in res) {
        router.push("/oyuncular");
        return;
      }

      const loadedProfile = res.profile as ProfileBasic;
      setPlayer(loadedProfile);
      setProfileDraft({
        fullName: loadedProfile.full_name || "",
        team: (loadedProfile.team || "").trim(),
        position: (loadedProfile.position || "").trim(),
        number: (loadedProfile.number || "").trim(),
        height: loadedProfile.height != null ? String(loadedProfile.height) : "",
        weight: loadedProfile.weight != null ? String(loadedProfile.weight) : "",
      });

      const results = (res.results || []) as FieldTestResultRow[];
      setTableMetrics(results);
      setWellnessReports((res.wellnessReports || []) as WellnessReportRow[]);
      setBodyMetrics((res.bodyMetrics || []) as BodyMetricRow[]);
      setFinancePackage((res.financeAndPackage as never) || null);
      setTimelineEvents((res.timelineEvents || []) as TimelineEvent[]);

      const latestMap: Record<string, RadarPoint> = {};
      results.forEach((r) => {
        const mName = r.test_definitions?.name;
        if (mName && !latestMap[mName]) {
          latestMap[mName] = {
            subject: mName,
            A: r.value,
            fullMark: 100,
          };
        }
      });
      setRadarData(Object.values(latestMap));

      const loads = (res.loads || []) as TrainingLoadRow[];
      setTrainingLoads(loads);
      if (loads.length > 0) {
        calculateACWR(loads);
        const chartData = loads.slice(-7).map((l) => ({
          date: new Date(l.measurement_date || "").toLocaleDateString("tr-TR", { weekday: "short" }),
          yuk: l.total_load || 0,
        }));
        setWeeklyLoads(chartData);
      } else {
        setWeeklyLoads([]);
        setAcwrStatus({ ratio: 0, label: "Veri Bekleniyor", color: "text-gray-500" });
      }

      const positionsRes = await listPositionOptionsForManagement();
      if (!("error" in positionsRes)) {
        setPositionOptions(positionsRes.positions || []);
      }
      const teamsRes = await listTeamsForActor();
      if (!("error" in teamsRes)) {
        setTeamOptions((teamsRes.teams || []).map((t) => String(t.name)).filter(Boolean));
      }
      await loadInjuryNotes(id);
    } catch (e) {
      console.error("Veri hatası:", e);
      router.push("/oyuncular");
    } finally {
      setLoading(false);
    }
  }, [id, router, calculateACWR, loadInjuryNotes]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleInjuryCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setInjurySaving(true);
    setInjuryMessage(null);

    const fd = new FormData();
    fd.append("athleteId", id);
    fd.append("injuryType", injuryType);
    fd.append("note", injuryNoteText);
    injuryImages.forEach((file) => fd.append("images", file));

    const result = await createAthleteInjuryNote(fd);
    if ("success" in result && result.success) {
      setInjuryType("");
      setInjuryNoteText("");
      setInjuryImages([]);
      setInjuryMessage("Sakatlık kaydı eklendi.");
      await loadInjuryNotes(id);
    } else {
      setInjuryMessage(("error" in result && result.error) || "Sakatlık kaydı eklenemedi.");
    }
    setInjurySaving(false);
  }

  async function handleInjuryDeactivate(noteId: string) {
    if (!id) return;
    setDeactivatingInjuryId(noteId);
    setInjuryMessage(null);
    const result = await deactivateAthleteInjuryNote(noteId);
    if ("success" in result && result.success) {
      setInjuryMessage("Sakatlık kaydı pasife alındı.");
      await loadInjuryNotes(id);
    } else {
      setInjuryMessage(("error" in result && result.error) || "Kayıt pasife alınamadı.");
    }
    setDeactivatingInjuryId(null);
  }

  if (loading || !player) {
    return (
      <div className="flex min-h-[55dvh] min-w-0 flex-col items-center justify-center gap-6 overflow-x-hidden bg-black px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="h-12 w-12 animate-spin text-[#7c3aed]" aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-[0.4em] text-gray-500">Sporcu Profili Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] text-white min-h-0 min-w-0 bg-black p-4 md:p-6 overflow-x-hidden">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center min-w-0">
        <Link
          href="/oyuncular"
          className="group inline-flex items-center gap-3 text-gray-500 sm:hover:text-white transition-all self-start min-h-11 touch-manipulation rounded-xl"
        >
          <div className="shrink-0 rounded-xl border border-white/5 bg-[#121215] p-2.5 shadow-lg transition-all sm:group-hover:bg-[#7c3aed]/20">
            <ChevronLeft size={18} aria-hidden />
          </div>
          <span className="text-[9px] font-black italic uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white break-words">
            KADRO ANALİZİNE DÖN
          </span>
        </Link>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#121215] border border-white/5 rounded-xl shadow-lg min-w-0 max-w-full">
          <div className={`w-2 h-2 shrink-0 rounded-full animate-pulse ${acwrStatus.color.replace("text", "bg")}`} />
          <span className={`text-[8px] sm:text-[9px] font-black italic uppercase tracking-wide sm:tracking-wider break-words ${acwrStatus.color}`}>
            DURUM: {acwrStatus.label} <span className="mx-1 sm:mx-2 opacity-20">|</span> ACWR: {acwrStatus.ratio}
          </span>
        </div>
      </div>

      <section
        id="sporcu-ozet"
        className="rounded-2xl md:rounded-3xl border border-white/5 bg-[#121215] p-5 md:p-7 shadow-xl min-w-0"
      >
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <h2 className="text-sm font-black italic uppercase tracking-tight text-white md:text-base">
              Sporcu <span className="text-[#7c3aed]">özeti</span>
            </h2>
            <div className={`rounded-xl border px-4 py-3 ${priorityCue.wrapClass}`}>
              <p className={`text-[11px] font-bold leading-relaxed ${priorityCue.textClass}`}>{priorityCue.text}</p>
            </div>
            {id ? (
              <p className="text-[10px] font-bold text-gray-500">
                Şimdi:{" "}
                <Link
                  href={`/finans/${id}`}
                  className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]"
                >
                  Finansı
                </Link>
                ,{" "}
                <a href="#sakatlik-gecmisi" className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]">
                  sakatlığı
                </a>
                ,{" "}
                <Link
                  href="/performans/wellness-detay"
                  className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]"
                >
                  wellness arşivini
                </Link>{" "}
                ve{" "}
                <Link
                  href="/notlar-haftalik-program"
                  className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]"
                >
                  program notlarını
                </Link>{" "}
                kontrol edin.
              </p>
            ) : null}
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-xl lg:shrink-0">
            <QuickStat label="ACWR" value={String(acwrStatus.ratio)} sub={acwrStatus.label} />
            <QuickStat label="Aktif sakatlık" value={activeInjuryCount} sub="kayıt" />
            <QuickStat
              label="Son wellness"
              value={latestWellness ? new Date(latestWellness.report_date).toLocaleDateString("tr-TR") : "—"}
              sub={latestWellness ? "Tarih" : "Kayıt yok"}
            />
            <QuickStat label="Yük kaydı" value={trainingLoads.length} sub="satır" />
          </div>
        </div>

        <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-4 text-[11px] font-bold sm:grid-cols-4">
          <div>
            <p className="text-gray-500">Aktif paket</p>
            <p className="mt-1 text-white">{financePackage?.activePackageName || "Yok"}</p>
          </div>
          <div>
            <p className="text-gray-500">Kalan ders</p>
            <p className="mt-1 text-white tabular-nums">{financePackage?.remainingLessons ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-500">Ödeme durumu</p>
            <p className="mt-1 text-white">{localizedPaymentStatus}</p>
          </div>
          <div>
            <p className="text-gray-500">Finans & Paket</p>
            {id ? (
              <Link href={`/finans/${id}`} className="mt-1 inline-block text-[#c4b5fd] sm:hover:text-[#e9d5ff]">
                Detaya git →
              </Link>
            ) : (
              <p className="mt-1 text-white">—</p>
            )}
          </div>
        </div>

        {id ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-5">
            <Link
              href={`/finans/${id}`}
              className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-3 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:border-[#7c3aed]/50"
            >
              <CreditCard size={14} aria-hidden /> Finans
            </Link>
            <a
              href="#sakatlik-gecmisi"
              className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/10"
            >
              <ClipboardList size={14} aria-hidden /> Sakatlık
            </a>
            <Link
              href="/performans/wellness-detay"
              className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/10"
            >
              <BarChart2 size={14} aria-hidden /> Wellness
            </Link>
            <Link
              href="/notlar-haftalik-program"
              className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/10"
            >
              <FileText size={14} aria-hidden /> Program
            </Link>
          </div>
        ) : null}
      </section>

      <section
        id="sporcu-profil"
        className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl relative overflow-hidden group min-w-0"
      >
        <div className="flex flex-col xl:flex-row gap-6 md:gap-8 items-center relative z-10">
          <div className="flex h-24 w-24 shrink-0 transform items-center justify-center rounded-2xl border-2 border-white/10 bg-gradient-to-br from-[#7c3aed] to-[#2e1065] text-3xl font-black italic text-white shadow-lg shadow-[#7c3aed]/15 transition-transform duration-500 sm:h-28 sm:w-28 sm:text-4xl md:rounded-3xl sm:group-hover:rotate-2">
            {player.full_name?.substring(0, 1).toUpperCase()}
          </div>

          <div className="flex-1 space-y-4 text-center xl:text-left min-w-0">
            <div>
              <div className="flex flex-wrap justify-center xl:justify-start items-center gap-2 mb-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest italic ${
                    player.team?.trim()
                      ? "border-white/10 bg-white/10 text-white"
                      : "border-amber-500/35 bg-amber-500/15 text-amber-200"
                  }`}
                >
                  {player.team?.trim() ? player.team : "Takım belirtilmedi"}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black italic text-white uppercase tracking-tight leading-tight break-words">
                <span className="block sm:inline break-words">{player.full_name?.split(" ")[0]}</span>
                {player.full_name?.includes(" ") ? (
                  <>
                    {" "}
                    <span className="text-[#7c3aed] break-words">{player.full_name?.split(" ").slice(1).join(" ")}</span>
                  </>
                ) : null}
              </h1>
            </div>

            <div className="flex flex-wrap justify-center xl:justify-start gap-2">
              <MetricBadge
                icon={<Target size={14} />}
                label="MEVKI"
                val={player.position ? player.position : "MEVKİ BELİRTİLMEDİ"}
                color={player.position ? "text-white" : "text-amber-300"}
              />
              <MetricBadge icon={<ShieldCheck size={14} />} label="BOY" val={`${player.height || "--"} CM`} />
              <MetricBadge icon={<Heart size={14} />} label="AĞIRLIK" val={`${player.weight || "--"} KG`} />
              <MetricBadge icon={<Droplets size={14} />} label="FORMA" val={`#${player.number || "--"}`} color="text-[#7c3aed]" />
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!id) return;
                setUpdatingPosition(true);
                setPositionMessage(null);
                const result = await updateAthleteProfileForManagement(id, {
                  fullName: profileDraft.fullName,
                  team: profileDraft.team,
                  position: profileDraft.position,
                  number: profileDraft.number,
                  height: profileDraft.height,
                  weight: profileDraft.weight,
                });
                if ("success" in result && result.success) {
                  setPlayer((prev) =>
                    prev
                      ? {
                          ...prev,
                          full_name: profileDraft.fullName.trim(),
                          team: profileDraft.team.trim() || null,
                          position: profileDraft.position.trim() || null,
                          number: profileDraft.number.trim() || null,
                          height: profileDraft.height.trim() ? Number(profileDraft.height) : null,
                          weight: profileDraft.weight.trim() ? Number(profileDraft.weight) : null,
                        }
                      : prev
                  );
                  setPositionMessage("Sporcu profili güncellendi.");
                } else {
                  setPositionMessage(("error" in result && result.error) || "Sporcu profili güncellenemedi.");
                }
                setUpdatingPosition(false);
              }}
              className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2"
            >
              <input
                value={profileDraft.fullName}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder="Ad soyad"
                className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed] sm:col-span-2"
              />
              <input
                value={profileDraft.team}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, team: e.target.value.toUpperCase() }))}
                list="athlete-team-options"
                placeholder="Takım (opsiyonel)"
                className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black uppercase text-white outline-none focus:border-[#7c3aed]"
              />
              <datalist id="athlete-team-options">
                {teamOptions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <input
                value={profileDraft.position}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, position: e.target.value.toUpperCase() }))}
                list="athlete-position-options"
                placeholder="Pozisyon güncelle (opsiyonel)"
                className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black uppercase text-white outline-none focus:border-[#7c3aed]"
              />
              <input
                value={profileDraft.number}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, number: e.target.value.toUpperCase() }))}
                placeholder="Forma no (opsiyonel)"
                className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black uppercase text-white outline-none focus:border-[#7c3aed]"
              />
              <input
                type="number"
                min={50}
                max={260}
                value={profileDraft.height}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, height: e.target.value }))}
                placeholder="Boy (cm)"
                className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed]"
              />
              <input
                type="number"
                min={20}
                max={300}
                value={profileDraft.weight}
                onChange={(e) => setProfileDraft((prev) => ({ ...prev, weight: e.target.value }))}
                placeholder="Kilo (kg)"
                className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed]"
              />
              <datalist id="athlete-position-options">
                {positionOptions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <button
                type="submit"
                disabled={updatingPosition}
                className="min-h-11 rounded-xl bg-[#7c3aed] px-4 py-3 text-[10px] font-black uppercase text-white disabled:opacity-60 sm:hover:bg-[#6d28d9] sm:col-span-2 sm:w-fit"
              >
                {updatingPosition ? "Güncelleniyor..." : "Profili Kaydet"}
              </button>
            </form>
            {positionMessage ? (
              <div className="mt-2 min-w-0 break-words">
                <Notification
                  message={positionMessage}
                  variant={
                    positionMessage.toLowerCase().includes("güncellendi") ||
                    positionMessage.toLowerCase().includes("guncellendi")
                      ? "success"
                      : "error"
                  }
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="absolute top-0 right-0 w-[280px] h-[280px] md:w-[360px] md:h-[360px] bg-[#7c3aed]/10 blur-[100px] -z-0 pointer-events-none rounded-full" />
      </section>

      <div className="grid min-w-0 gap-5 md:gap-6 lg:grid-cols-2 lg:items-start">
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
          <Notification message={injuryMessage} variant={injuryMessage.toLowerCase().includes("eklendi") || injuryMessage.toLowerCase().includes("pasife") ? "success" : "error"} />
        ) : null}

        <form onSubmit={handleInjuryCreate} className="grid grid-cols-1 gap-3 rounded-2xl border border-white/5 bg-black/30 p-4 sm:grid-cols-2">
          <input
            value={injuryType}
            onChange={(e) => setInjuryType(e.target.value)}
            placeholder="Sakatlık türü (örn: Hamstring zorlanması)"
            className="min-h-11 w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-black text-white outline-none focus:border-[#7c3aed] sm:col-span-2"
          />
          <textarea
            value={injuryNoteText}
            onChange={(e) => setInjuryNoteText(e.target.value)}
            placeholder="Antrenör notu"
            rows={3}
            className="w-full min-w-0 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#7c3aed] sm:col-span-2"
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={(e) => setInjuryImages(Array.from(e.target.files || []))}
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
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Henüz sakatlık kaydı bulunmuyor.</p>
            <p className="mt-2 text-[10px] font-bold text-gray-500">Yeni kayıt için aşağıdaki formu doldurun; görsel eklemek opsiyoneldir.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {injuryNotes.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/5 bg-black/25 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase text-white break-words">{item.injuryType}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">
                      {new Date(item.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })} · {item.createdByName}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={deactivatingInjuryId === item.id}
                    onClick={() => void handleInjuryDeactivate(item.id)}
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

        <aside
          id="son-wellness"
          className="flex min-w-0 flex-col gap-4 self-stretch rounded-2xl border border-white/5 bg-[#121215] p-5 shadow-xl md:rounded-3xl md:p-7"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="text-base font-black italic uppercase tracking-tight text-white sm:text-lg">
              Son <span className="text-[#7c3aed]">wellness</span>
            </h2>
            <Link
              href="/performans/wellness-detay"
              className="shrink-0 text-[9px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
            >
              Arşiv
            </Link>
          </div>
          {latestWellness ? (
            <div className="space-y-3 rounded-2xl border border-white/5 bg-black/30 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rapor tarihi</p>
              <p className="text-sm font-black text-white">
                {new Date(latestWellness.report_date).toLocaleDateString("tr-TR", { dateStyle: "long" })}
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400">
                {latestWellness.fatigue != null ? <span>Yorgunluk: {latestWellness.fatigue}/10</span> : null}
                {latestWellness.sleep_quality != null ? <span>Uyku: {latestWellness.sleep_quality}/10</span> : null}
                {latestWellness.energy_level != null ? <span>Enerji: {latestWellness.energy_level}/10</span> : null}
                {latestWellness.stress_level != null ? <span>Stres: {latestWellness.stress_level}/10</span> : null}
              </div>
              <Link
                href="#performans-analitigi"
                className="inline-block text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
              >
                Grafikler ve trendler için aşağı kaydırın →
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
              <p className="text-[10px] font-bold text-gray-500">Kayıtlı wellness raporu yok.</p>
              <p className="mt-2 text-[10px] text-gray-600">
                Sabah raporu veya wellness girişi yapıldığında burada son kayıt görünür. Tüm arşiv için{" "}
                <Link href="/performans/wellness-detay" className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]">
                  wellness ekranına
                </Link>{" "}
                gidin.
              </p>
            </div>
          )}
          <p className="mt-auto text-[10px] font-bold text-gray-500">
            Derin analiz:{" "}
            <a href="#performans-analitigi" className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]">
              Performans analitiği
            </a>
          </p>
        </aside>
      </div>

      <section id="hizli-performans" className="min-w-0 space-y-3">
        <div className="mb-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-xs font-black italic uppercase tracking-tight text-gray-400 sm:text-sm">Hızlı performans görünümü</h2>
          <Link
            href="#performans-analitigi"
            className="shrink-0 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
          >
            ACWR ve wellness analitiği →
          </Link>
        </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 min-w-0">
        <div className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl relative overflow-hidden min-w-0">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#7c3aed]/10 rounded-xl text-[#7c3aed]">
              <Activity size={18} />
            </div>
            <h3 className="text-sm md:text-base font-black italic text-white uppercase tracking-tight">
              Yetenek <span className="text-[#7c3aed]">Spektrumu</span>
            </h3>
          </div>
          <div className="h-[220px] sm:h-[260px] md:h-[280px] w-full min-w-0">
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="#ffffff05" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 700 }} />
                  <Radar name="Sporcu" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.4} strokeWidth={4} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <NoData label="ATLETİK TEST VERİSİ GİRİLMEMİŞ" />
            )}
          </div>
        </div>

        <div className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl relative overflow-hidden min-w-0">
          <div className="flex justify-between items-start mb-5 gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-[#7c3aed]/10 rounded-xl text-[#7c3aed] shrink-0">
                <TrendingUp size={18} />
              </div>
              <h3 className="text-sm md:text-base font-black italic text-white uppercase tracking-tight break-words min-w-0">
                Yük <span className="text-[#7c3aed]">Dinamikleri</span>
              </h3>
            </div>
            <div className="hidden md:block px-3 py-1.5 bg-black border border-white/5 rounded-full text-[8px] font-black text-gray-600 uppercase tracking-widest shrink-0">
              SON 7 GÜN
            </div>
          </div>
          <div className="h-[220px] sm:h-[260px] md:h-[280px] w-full min-w-0">
            {weeklyLoads.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyLoads} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#4b5563", fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#4b5563", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1c1c21",
                      border: "1px solid rgba(124,58,237,0.2)",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: "bold",
                    }}
                    itemStyle={{ color: "#7c3aed" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="yuk"
                    stroke="#7c3aed"
                    strokeWidth={3}
                    dot={{ fill: "#7c3aed", stroke: "#121215", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <NoData label="ANTRENMAN YÜK VERİSİ EKSİK" />
            )}
          </div>
        </div>
      </div>
      </section>

      <section id="operasyon-zaman-cizelgesi" className="rounded-2xl border border-white/5 bg-[#121215] p-5 shadow-xl md:rounded-3xl md:p-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wide text-white">Operasyon timeline</h2>
          <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Ders · Ödeme · Sakatlık · Not</span>
        </div>
        {timelineEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-5 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Henüz timeline kaydı yok.</p>
            <p className="mt-2 text-[10px] font-bold text-gray-600">
              İlk kaydı oluşturmak için{" "}
              <Link href="/dersler" className="text-[#c4b5fd] sm:hover:text-[#e9d5ff]">
                ders planlamaya
              </Link>{" "}
              veya{" "}
              <Link href={id ? `/finans/${id}` : "/finans"} className="text-[#c4b5fd] sm:hover:text-[#e9d5ff]">
                finans ekranına
              </Link>{" "}
              geçin.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {timelineEvents.slice(0, 60).map((event) => (
              <li key={event.id} className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] font-bold">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-white">{event.title}</p>
                  <span className="text-gray-500">{new Date(event.at).toLocaleString("tr-TR")}</span>
                </div>
                <p className="mt-1 text-gray-400">{event.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AthletePerformanceInsightsPanel
        loads={trainingLoads}
        wellnessReports={wellnessReports}
        bodyMetrics={bodyMetrics}
      />

      <AthleteFieldTestsPanel results={tableMetrics} />
    </div>
  );
}

function QuickStat({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5">
      <p className="text-[8px] font-black uppercase tracking-wider text-gray-600">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
      <p className="text-[8px] font-bold uppercase text-gray-500">{sub}</p>
    </div>
  );
}

function MetricBadge({
  icon,
  label,
  val,
  color = "text-white",
}: {
  icon: ReactNode;
  label: string;
  val: string;
  color?: string;
}) {
  return (
    <div className="bg-black/40 px-3 py-2.5 rounded-xl border border-white/5 flex items-center gap-2.5 transition-all sm:hover:border-[#7c3aed]/30 sm:hover:bg-black/60 shadow-md group/m min-w-0">
      <div className="shrink-0 text-[#7c3aed] transition-transform sm:group-hover/m:scale-105">{icon}</div>
      <div className="flex flex-col min-w-0">
        <span className="text-[7px] font-black text-gray-600 uppercase tracking-wider">{label}</span>
        <span className={`${color} font-black italic text-xs sm:text-sm tracking-tight break-words`}>{val}</span>
      </div>
    </div>
  );
}

function NoData({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-black/20 group px-4">
      <Activity className="mb-3 text-gray-800 transition-colors sm:group-hover:text-[#7c3aed]" size={32} aria-hidden />
      <p className="text-center text-[8px] font-black uppercase italic leading-relaxed tracking-[0.25em] text-gray-700 break-words">{label}</p>
    </div>
  );
}
