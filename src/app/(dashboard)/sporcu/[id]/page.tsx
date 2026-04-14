"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { listTeamsForActor } from "@/lib/actions/teamActions";
import { AthleteFieldTestsPanel, type FieldTestResultRow } from "./AthleteFieldTestsPanel";
import { AthletePerformanceInsightsPanel, type BodyMetricRow } from "./AthletePerformanceInsightsPanel";
import Notification from "@/components/Notification";

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
    } catch (e) {
      console.error("Veri hatası:", e);
      router.push("/oyuncular");
    } finally {
      setLoading(false);
    }
  }, [id, router, calculateACWR]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

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

      <section className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl relative overflow-hidden group min-w-0">
        <div className="flex flex-col xl:flex-row gap-6 md:gap-8 items-center relative z-10">
          <div className="flex h-24 w-24 shrink-0 transform items-center justify-center rounded-2xl border-2 border-white/10 bg-gradient-to-br from-[#7c3aed] to-[#2e1065] text-3xl font-black italic text-white shadow-lg shadow-[#7c3aed]/15 transition-transform duration-500 sm:h-28 sm:w-28 sm:text-4xl md:rounded-3xl sm:group-hover:rotate-2">
            {player.full_name?.substring(0, 1).toUpperCase()}
          </div>

          <div className="flex-1 space-y-4 text-center xl:text-left min-w-0">
            <div>
              <div className="flex flex-wrap justify-center xl:justify-start items-center gap-2 mb-2">
                <span className="bg-[#7c3aed] text-white px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest italic">
                  PRO ELITE
                </span>
                <span className="text-gray-600 font-black text-[8px] uppercase tracking-widest">{player.team || "AKADEMİ"}</span>
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
              <MetricBadge icon={<Target size={14} />} label="MEVKİ" val={player.position || "GKP"} />
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
                  setPositionMessage("Sporcu profili guncellendi.");
                } else {
                  setPositionMessage(("error" in result && result.error) || "Sporcu profili guncellenemedi.");
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
                placeholder="Takim (opsiyonel)"
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
                placeholder="Pozisyon guncelle (opsiyonel)"
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
                {updatingPosition ? "Guncelleniyor..." : "Profili Kaydet"}
              </button>
            </form>
            {positionMessage ? (
              <div className="mt-2 min-w-0 break-words">
                <Notification
                  message={positionMessage}
                  variant={positionMessage.toLowerCase().includes("guncellendi") ? "success" : "error"}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="absolute top-0 right-0 w-[280px] h-[280px] md:w-[360px] md:h-[360px] bg-[#7c3aed]/10 blur-[100px] -z-0 pointer-events-none rounded-full" />
      </section>

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

      <AthletePerformanceInsightsPanel
        loads={trainingLoads}
        wellnessReports={wellnessReports}
        bodyMetrics={bodyMetrics}
      />

      <AthleteFieldTestsPanel results={tableMetrics} />
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
