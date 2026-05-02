"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  User,
  User2,
  Users,
} from "lucide-react";
import Notification from "@/components/Notification";
import { cancelLesson, createLesson, hardDeleteLesson } from "@/lib/actions/lessonActions";
import { createPrivateLessonSession, cancelPrivateLessonSession } from "@/lib/actions/privateLessonSessionActions";
import { listPrivateLessonPackagesForManagement } from "@/lib/actions/privateLessonPackageActions";
import { createLocationAction, listLocationsForActor } from "@/lib/actions/locationActions";
import { listLessonsSnapshot, listWeeklyLessonScheduleSnapshot } from "@/lib/actions/snapshotActions";
import { formatLessonDateTimeTr, formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import {
  SCHEDULE_APP_TIME_ZONE,
  isoToZonedClockMinutesFromMidnight,
  isoToZonedDateKey,
  wallClockInZoneToUtcIso,
  zonedNowClockMinutes,
} from "@/lib/schedule/scheduleWallTime";
import { getWeekDayStarts, getWeekStartMondayIso } from "@/lib/schedule/weeklySchedule";
import type { WeeklyLessonScheduleItem, WeeklyLessonScheduleSnapshot, WeeklyLessonTypeFilter } from "@/lib/types";
import type { PrivateLessonPackage } from "@/lib/types";

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 23;
const DAY_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
const GRID_CONTAINER_HEIGHT_REM = (GRID_END_HOUR - GRID_START_HOUR + 1) * 4;

/** Hafta başı (Pzt 00:00 UTC) seçicisi — hafta sınırı mevcut UTC-temelli yardımcılarla uyumlu kalsın. */
function utcDateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayTitle(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    timeZone: SCHEDULE_APP_TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function lessonStatusLabelTr(status: string) {
  const s = status.toLowerCase();
  if (s === "scheduled" || s === "planned") return "Planlandı";
  if (s === "cancelled") return "İptal Edildi";
  if (s === "completed") return "Tamamlandı";
  return "Planlandı";
}

function itemTopAndHeight(item: WeeklyLessonScheduleItem) {
  const startMinutes = isoToZonedClockMinutesFromMidnight(item.startsAt);
  const endMinutes = isoToZonedClockMinutesFromMidnight(item.endsAt);
  const clampStart = Math.max(startMinutes, GRID_START_HOUR * 60);
  const clampEnd = Math.min(Math.max(endMinutes, clampStart + 20), GRID_END_HOUR * 60);
  const top = ((clampStart - GRID_START_HOUR * 60) / DAY_MINUTES) * 100;
  const height = Math.max(((clampEnd - clampStart) / DAY_MINUTES) * 100, 3.2);
  return { top, height };
}

type DayLayoutItem = {
  item: WeeklyLessonScheduleItem;
  laneIndex: number;
  laneCount: number;
  groupId: string;
  groupSize: number;
};

function computeDayOverlapLayout(items: WeeklyLessonScheduleItem[]): DayLayoutItem[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const groups: WeeklyLessonScheduleItem[][] = [];
  let currentGroup: WeeklyLessonScheduleItem[] = [];
  let currentGroupMaxEnd = -1;

  for (const item of sorted) {
    const startMs = new Date(item.startsAt).getTime();
    const endMs = new Date(item.endsAt).getTime();
    if (currentGroup.length === 0) {
      currentGroup = [item];
      currentGroupMaxEnd = endMs;
      continue;
    }
    if (startMs < currentGroupMaxEnd) {
      currentGroup.push(item);
      currentGroupMaxEnd = Math.max(currentGroupMaxEnd, endMs);
      continue;
    }
    groups.push(currentGroup);
    currentGroup = [item];
    currentGroupMaxEnd = endMs;
  }
  if (currentGroup.length > 0) groups.push(currentGroup);

  const layout: DayLayoutItem[] = [];
  groups.forEach((group, groupIndex) => {
    const laneEnds: number[] = [];
    const laneById = new Map<string, number>();
    const groupSorted = [...group].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    );

    for (const item of groupSorted) {
      const startMs = new Date(item.startsAt).getTime();
      const endMs = new Date(item.endsAt).getTime();
      let laneIndex = laneEnds.findIndex((laneEnd) => laneEnd <= startMs);
      if (laneIndex === -1) {
        laneIndex = laneEnds.length;
        laneEnds.push(endMs);
      } else {
        laneEnds[laneIndex] = endMs;
      }
      laneById.set(item.id, laneIndex);
    }

    const laneCount = Math.max(group.length, 1);
    const groupId = `g-${groupIndex}`;
    for (const item of group) {
      layout.push({
        item,
        laneIndex: laneById.get(item.id) ?? 0,
        laneCount,
        groupId,
        groupSize: group.length,
      });
    }
  });

  return layout;
}

function nowLineTopPercent(now: Date) {
  const { minutesFromDayStart } = zonedNowClockMinutes(now);
  if (minutesFromDayStart < GRID_START_HOUR * 60 || minutesFromDayStart > GRID_END_HOUR * 60) return null;
  return ((minutesFromDayStart - GRID_START_HOUR * 60) / DAY_MINUTES) * 100;
}

function parseClockToMinutes(clock: string) {
  const [hRaw, mRaw] = clock.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToClock(total: number) {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase();
  const match = /^#([0-9a-f]{6})$/.exec(normalized);
  if (!match) return null;
  const raw = match[1];
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}

function locationCardStyle(locationColor: string | null): React.CSSProperties | undefined {
  if (!locationColor) return undefined;
  const rgb = hexToRgb(locationColor);
  if (!rgb) return undefined;
  const { r, g, b } = rgb;
  return {
    background: `linear-gradient(to bottom, rgba(${r}, ${g}, ${b}, 0.26), rgba(${r}, ${g}, ${b}, 0.16))`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.62)`,
    boxShadow: `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.34), 0 18px 30px -16px rgba(${r}, ${g}, ${b}, 0.52)`,
  };
}

function SelectPremium({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ui-select min-h-11 w-full appearance-none rounded-xl border-white/10 bg-[#17171f] pr-10 text-sm font-semibold"
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c4b5fd]"
        />
      </div>
    </label>
  );
}

export default function WeeklyLessonSchedulePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getWeekStartMondayIso());
  const [lessonType, setLessonType] = useState<WeeklyLessonTypeFilter>("all");
  const [coachId, setCoachId] = useState("");
  const [location, setLocation] = useState("");
  const [snapshot, setSnapshot] = useState<WeeklyLessonScheduleSnapshot | null>(null);
  const [selected, setSelected] = useState<WeeklyLessonScheduleItem | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [quickCreateAt, setQuickCreateAt] = useState<Date | null>(null);
  const [quickMode, setQuickMode] = useState<"group" | "private">("group");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickInfo, setQuickInfo] = useState<string | null>(null);
  const [quickCoachOptions, setQuickCoachOptions] = useState<Array<{ id: string; full_name: string }>>([]);
  const [quickPackages, setQuickPackages] = useState<PrivateLessonPackage[]>([]);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationColor, setNewLocationColor] = useState("#6b7280");
  const [locationBusy, setLocationBusy] = useState(false);
  const [groupForm, setGroupForm] = useState({
    title: "",
    coachId: "",
    startClock: "",
    endClock: "",
    durationMinutes: "60",
    location: "Ana Saha",
    capacity: "20",
  });
  const [privateForm, setPrivateForm] = useState({
    packageId: "",
    startClock: "",
    endClock: "",
    durationMinutes: "60",
    coachId: "",
    location: "",
  });
  const [quickGroupTitle, setQuickGroupTitle] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [focusedDayKey, setFocusedDayKey] = useState<string | null>(null);
  const [overlapListOpen, setOverlapListOpen] = useState(false);
  const [overlapListTitle, setOverlapListTitle] = useState("");
  const [overlapListItems, setOverlapListItems] = useState<WeeklyLessonScheduleItem[]>([]);
  const [recentCreatedRange, setRecentCreatedRange] = useState<{
    dayKey: string;
    startMinutes: number;
    endMinutes: number;
    expiresAt: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listLocationsForActor();
      if (cancelled || "error" in res) return;
      const nextLocations = (res.locations || []).map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
      }));
      setLocationOptions(nextLocations);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listWeeklyLessonScheduleSnapshot({
      weekStart,
      lessonType,
      coachId: coachId || undefined,
      location: location || undefined,
    });
    if ("error" in res) {
      setError(res.error);
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setSnapshot(res);
    if (res.selectedCoachId && res.selectedCoachId !== coachId) {
      setCoachId(res.selectedCoachId);
    }
    setLoading(false);
  }, [weekStart, lessonType, coachId, location]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchSnapshot();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const dayStarts = useMemo(() => getWeekDayStarts(weekStart), [weekStart]);
  const shownDayStarts = useMemo(
    () => (focusedDayKey ? dayStarts.filter((d) => isoToZonedDateKey(d) === focusedDayKey) : dayStarts),
    [dayStarts, focusedDayKey]
  );
  useEffect(() => {
    if (!focusedDayKey) return;
    if (shownDayStarts.length > 0) return;
    const id = window.setTimeout(() => setFocusedDayKey(null), 0);
    return () => window.clearTimeout(id);
  }, [focusedDayKey, shownDayStarts]);
  const itemsByDay = useMemo(() => {
    const map = new Map<string, WeeklyLessonScheduleItem[]>();
    for (const dayIso of dayStarts) map.set(isoToZonedDateKey(dayIso), []);
    for (const item of snapshot?.items || []) {
      const key = isoToZonedDateKey(item.startsAt);
      if (!map.has(key)) continue;
      map.get(key)!.push(item);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [dayStarts, snapshot?.items]);

  const hourRows = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i),
    []
  );

  function shiftWeek(days: number) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + days);
    setWeekStart(getWeekStartMondayIso(start.toISOString()));
  }

  const weekLabel = `${new Date(dayStarts[0]).toLocaleDateString("tr-TR", { timeZone: SCHEDULE_APP_TIME_ZONE })} - ${new Date(
    dayStarts[6]
  ).toLocaleDateString("tr-TR", { timeZone: SCHEDULE_APP_TIME_ZONE })}`;
  const todayKey = isoToZonedDateKey(now.toISOString());
  const nowTop = nowLineTopPercent(now);
  const weekContainsToday = dayStarts.some((d) => isoToZonedDateKey(d) === todayKey);
  const summary = useMemo(() => {
    const items = snapshot?.items || [];
    const totalLessons = items.length;
    const groupLessons = items.filter((i) => i.sourceType === "group").length;
    const privateLessons = items.filter((i) => i.sourceType === "private").length;
    const activeCoachCount = new Set(items.map((i) => i.coachId).filter(Boolean)).size;
    return { totalLessons, groupLessons, privateLessons, activeCoachCount };
  }, [snapshot?.items]);
  const hasFilterBeyondWeek = lessonType !== "all" || coachId.trim().length > 0 || location.trim().length > 0;
  const hasOnlyCoachFilter = coachId.trim().length > 0 && lessonType === "all" && location.trim().length === 0;
  const selectedCoachName = useMemo(
    () => snapshot?.coachOptions.find((c) => c.id === coachId)?.full_name || null,
    [snapshot?.coachOptions, coachId]
  );
  const emptyState = useMemo(() => {
    if ((snapshot?.items.length || 0) > 0) return null;
    if (hasOnlyCoachFilter) {
      return {
        title: `${selectedCoachName || "Seçili koç"} için bu haftada ders yok`,
        description: "Koç filtresini kaldırabilir, farklı bir hafta seçebilir veya yeni ders planlayabilirsiniz.",
      };
    }
    if (hasFilterBeyondWeek) {
      return {
        title: "Filtreye uygun ders bulunamadı",
        description: "Filtreleri genişleterek daha fazla kayıt görebilir veya yeni ders ekleyebilirsiniz.",
      };
    }
    return {
      title: "Bu hafta için ders planı bulunmuyor",
      description: "Çizelge hazır. İlk dersi oluşturduğunuzda haftalık plan burada görünecek.",
    };
  }, [snapshot?.items.length, hasOnlyCoachFilter, hasFilterBeyondWeek, selectedCoachName]);

  const quickCreateDateLabel = quickCreateAt
    ? quickCreateAt.toLocaleDateString("tr-TR", {
        timeZone: SCHEDULE_APP_TIME_ZONE,
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";
  const quickCreateTimeLabel = quickCreateAt ? formatLessonTimeTr(quickCreateAt.toISOString()) : "";
  const quickHasActivePackage = quickPackages.some((p) => p.isActive && p.remainingLessons > 0);
  const selectedLocationColor =
    locationOptions.find((loc) => loc.name === location)?.color || null;

  useEffect(() => {
    if (!quickCreateAt) return;
    let cancelled = false;
    const id = setTimeout(() => {
      setQuickBusy(true);
      setQuickError(null);
      setQuickInfo(null);
      void (async () => {
        const [lessonRes, packageRes] = await Promise.all([
          listLessonsSnapshot(1, 1),
          listPrivateLessonPackagesForManagement(),
        ]);
        if (cancelled) return;

        if (!("error" in lessonRes)) {
          setQuickCoachOptions(lessonRes.coaches || []);
          setGroupForm((prev) => ({
            ...prev,
            coachId: prev.coachId || lessonRes.coaches?.[0]?.id || "",
          }));
        } else {
          setQuickCoachOptions([]);
        }

        if (!("error" in packageRes)) {
          const active = (packageRes.packages || []).filter((p) => p.isActive && p.remainingLessons > 0);
          setQuickPackages(active);
          setPrivateForm((prev) => ({
            ...prev,
            packageId: prev.packageId || active[0]?.id || "",
            coachId: (() => {
              const selectedPackageId = prev.packageId || active[0]?.id || "";
              const selectedPackage = active.find((pkg) => pkg.id === selectedPackageId);
              return selectedPackage?.coachId || "";
            })(),
          }));
        } else {
          setQuickPackages([]);
          setQuickInfo("Özel ders planlama verisi alınamadı. Yetki veya paket durumu kontrol edilmelidir.");
        }

        const locationsRes = await listLocationsForActor();
        if (!("error" in locationsRes)) {
          const nextLocations = (locationsRes.locations || []).map((row) => ({
            id: row.id,
            name: row.name,
            color: row.color,
          }));
          setLocationOptions(nextLocations);
          setGroupForm((prev) => ({
            ...prev,
            location: prev.location || nextLocations[0]?.name || "Ana Saha",
          }));
          setPrivateForm((prev) => ({
            ...prev,
            location: prev.location || nextLocations[0]?.name || "",
          }));
        }
        setQuickBusy(false);
      })();
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [quickCreateAt]);

  useEffect(() => {
    if (!quickCreateAt) return;
    if (typeof window === "undefined") return;
    const id = setTimeout(() => {
      const lastCoach = window.localStorage.getItem("calendar.quick.groupCoachId") || "";
      const slotClock = formatLessonTimeTr(quickCreateAt.toISOString());
      const slotEnd = minutesToClock((parseClockToMinutes(slotClock) || 0) + 60);
      setGroupForm((prev) => ({
        ...prev,
        coachId: lastCoach || prev.coachId || "",
        startClock: slotClock,
        endClock: slotEnd,
        durationMinutes: "60",
      }));
      setPrivateForm((prev) => ({
        ...prev,
        startClock: slotClock,
        endClock: slotEnd,
        durationMinutes: "60",
      }));
    }, 0);
    return () => clearTimeout(id);
  }, [quickCreateAt]);

  useEffect(() => {
    if (!recentCreatedRange) return;
    const wait = Math.max(0, recentCreatedRange.expiresAt - Date.now());
    const timer = window.setTimeout(() => setRecentCreatedRange(null), wait);
    return () => window.clearTimeout(timer);
  }, [recentCreatedRange]);

  function selectedPackage() {
    return quickPackages.find((p) => p.id === privateForm.packageId) || null;
  }

  const canQuickPrivateCreate = useMemo(() => {
    const active = quickPackages.filter((p) => p.isActive && p.remainingLessons > 0);
    if (active.length !== 1) return false;
    return Boolean(active[0].coachId);
  }, [quickPackages]);

  function syncDurationFromRange(startClock: string, endClock: string) {
    const startMin = parseClockToMinutes(startClock);
    const endMin = parseClockToMinutes(endClock);
    if (startMin == null || endMin == null || endMin <= startMin) return;
    setGroupForm((prev) => ({ ...prev, durationMinutes: String(endMin - startMin) }));
  }

  function syncEndFromDuration(startClock: string, durationValue: string) {
    const startMin = parseClockToMinutes(startClock);
    const duration = Number(durationValue);
    if (startMin == null || !Number.isFinite(duration) || duration <= 0) return;
    setGroupForm((prev) => ({ ...prev, endClock: minutesToClock(startMin + duration) }));
  }

  function syncPrivateDurationFromRange(startClock: string, endClock: string) {
    const startMin = parseClockToMinutes(startClock);
    const endMin = parseClockToMinutes(endClock);
    if (startMin == null || endMin == null || endMin <= startMin) return;
    setPrivateForm((prev) => ({ ...prev, durationMinutes: String(endMin - startMin) }));
  }

  function syncPrivateEndFromDuration(startClock: string, durationValue: string) {
    const startMin = parseClockToMinutes(startClock);
    const duration = Number(durationValue);
    if (startMin == null || !Number.isFinite(duration) || duration <= 0) return;
    setPrivateForm((prev) => ({ ...prev, endClock: minutesToClock(startMin + duration) }));
  }

  const groupTimeValidation = useMemo(() => {
    const startMin = parseClockToMinutes(groupForm.startClock);
    const endMin = parseClockToMinutes(groupForm.endClock);
    if (startMin == null || endMin == null) {
      return { ok: false, message: "Başlangıç ve bitiş saati geçerli olmalı." };
    }
    if (endMin <= startMin) {
      return { ok: false, message: "Bitiş saati başlangıç saatinden büyük olmalı." };
    }
    return { ok: true, message: "" };
  }, [groupForm.startClock, groupForm.endClock]);

  const inlineTimePreview = useMemo(() => {
    if (!groupForm.startClock || !groupForm.endClock) return "";
    return `Bu ders ${groupForm.startClock} - ${groupForm.endClock} arasında planlanacak`;
  }, [groupForm.startClock, groupForm.endClock]);

  const privateTimeValidation = useMemo(() => {
    const startMin = parseClockToMinutes(privateForm.startClock);
    const endMin = parseClockToMinutes(privateForm.endClock);
    if (startMin == null || endMin == null) {
      return { ok: false, message: "Başlangıç ve bitiş saati geçerli olmalı." };
    }
    if (endMin <= startMin) {
      return { ok: false, message: "Bitiş saati başlangıç saatinden büyük olmalı." };
    }
    return { ok: true, message: "" };
  }, [privateForm.startClock, privateForm.endClock]);

  async function submitQuickGroupLesson() {
    if (!quickCreateAt) return;
    const duration = Number(groupForm.durationMinutes);
    if (!groupForm.title.trim()) {
      setQuickError("Ders adı zorunludur.");
      return;
    }
    if (!Number.isFinite(duration) || duration < 15) {
      setQuickError("Süre en az 15 dakika olmalıdır.");
      return;
    }
    if (!groupTimeValidation.ok) {
      setQuickError(groupTimeValidation.message);
      return;
    }
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString());
    const startClockEff = groupForm.startClock || quickCreateTimeLabel;
    const endClockEff =
      groupForm.endClock ||
      minutesToClock((parseClockToMinutes(groupForm.startClock || startClockEff || "00:00") || 0) + duration);
    const startIso = wallClockInZoneToUtcIso(lessonDate, startClockEff);
    const endIso = wallClockInZoneToUtcIso(lessonDate, endClockEff);
    if (!startIso || !endIso) {
      setQuickError("Başlangıç veya bitiş saati çözümlenemedi.");
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setQuickError("Bitiş saati başlangıçtan sonra olmalıdır.");
      return;
    }
    const fd = new FormData();
    fd.append("title", groupForm.title.trim());
    fd.append("description", "");
    fd.append("location", groupForm.location.trim() || "Ana Saha");
    fd.append("startTime", startIso);
    fd.append("endTime", endIso);
    fd.append("capacity", groupForm.capacity || "20");
    if (groupForm.coachId) fd.append("coachId", groupForm.coachId);

    setQuickBusy(true);
    setQuickError(null);
    setQuickInfo("Grup dersi kaydediliyor…");
    const res = await createLesson(fd);
    if ("error" in res) {
      setQuickError(res.error || "Grup dersi oluşturulamadı.");
      setQuickInfo(null);
      setQuickBusy(false);
      return;
    }
    setQuickInfo("Grup dersi oluşturuldu, takvim güncelleniyor…");
    await fetchSnapshot();
    setQuickBusy(false);
    setQuickCreateAt(null);
    setQuickInfo(null);
    setActionMessage("Grup dersi takvimden oluşturuldu.");
    setRecentCreatedRange({
      dayKey: isoToZonedDateKey(startIso),
      startMinutes: isoToZonedClockMinutesFromMidnight(startIso),
      endMinutes: isoToZonedClockMinutesFromMidnight(endIso),
      expiresAt: Date.now() + 3500,
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("calendar.quick.groupCoachId", groupForm.coachId || "");
      window.localStorage.setItem("calendar.quick.groupDuration", groupForm.durationMinutes || "60");
    }
  }

  async function submitQuickPrivateLesson() {
    if (!quickCreateAt) return;
    if (!privateForm.packageId) {
      setQuickError("Lütfen bir aktif paket seçin.");
      return;
    }
    const duration = Number(privateForm.durationMinutes);
    if (!Number.isFinite(duration) || duration < 15) {
      setQuickError("Süre en az 15 dakika olmalıdır.");
      return;
    }
    if (!privateForm.coachId.trim()) {
      setQuickError("Özel ders planlamak için koç seçmelisiniz.");
      return;
    }
    if (!privateTimeValidation.ok) {
      setQuickError(privateTimeValidation.message);
      return;
    }
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString());
    const slotClock = formatLessonTimeTr(quickCreateAt.toISOString());
    const startMin =
      parseClockToMinutes(privateForm.startClock || slotClock) || parseClockToMinutes(slotClock) || 0;
    const endMin =
      parseClockToMinutes(privateForm.endClock || minutesToClock(startMin + duration)) || (startMin + duration);
    const effectiveDuration = Math.max(15, endMin - startMin);
    const fd = new FormData();
    fd.append("packageId", privateForm.packageId);
    fd.append("lessonDate", lessonDate);
    fd.append("startClock", minutesToClock(startMin));
    fd.append("durationMinutes", String(effectiveDuration));
    if (privateForm.location.trim()) fd.append("location", privateForm.location.trim());
    if (privateForm.coachId.trim()) fd.append("coachId", privateForm.coachId.trim());

    setQuickBusy(true);
    setQuickError(null);
    setQuickInfo("Özel ders planı kaydediliyor…");
    const res = await createPrivateLessonSession(fd);
    if ("error" in res) {
      setQuickError(res.error || "Özel ders planlanamadı.");
      setQuickInfo(null);
      setQuickBusy(false);
      return;
    }
    setQuickInfo("Özel ders planlandı, takvim güncelleniyor…");
    await fetchSnapshot();
    setQuickBusy(false);
    setQuickCreateAt(null);
    setQuickInfo(null);
    setActionMessage("Özel ders takvimden planlandı.");
    setRecentCreatedRange({
      dayKey: lessonDate,
      startMinutes: startMin,
      endMinutes: endMin,
      expiresAt: Date.now() + 3500,
    });
  }

  async function submitOneClickGroupLesson() {
    if (!quickCreateAt) return;
    const duration = Number(groupForm.durationMinutes || "60");
    if (!groupForm.coachId) {
      setQuickError("Hızlı grup dersi için koç seçimi gerekli.");
      return;
    }
    if (!groupTimeValidation.ok) {
      setQuickError(groupTimeValidation.message);
      return;
    }
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString());
    const startClockEff = groupForm.startClock || quickCreateTimeLabel;
    const endClockEff =
      groupForm.endClock ||
      minutesToClock((parseClockToMinutes(groupForm.startClock || startClockEff || "00:00") || 0) + (Number.isFinite(duration) ? duration : 60));
    const startIso = wallClockInZoneToUtcIso(lessonDate, startClockEff);
    const endIso = wallClockInZoneToUtcIso(lessonDate, endClockEff);
    if (!startIso || !endIso) {
      setQuickError("Başlangıç veya bitiş saati çözümlenemedi.");
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setQuickError("Bitiş saati başlangıçtan sonra olmalıdır.");
      return;
    }
    const fd = new FormData();
    fd.append("title", quickGroupTitle.trim() || "Hızlı Grup Dersi");
    fd.append("description", "");
    fd.append("location", groupForm.location.trim() || "Ana Saha");
    fd.append("startTime", startIso);
    fd.append("endTime", endIso);
    fd.append("capacity", groupForm.capacity || "20");
    fd.append("coachId", groupForm.coachId);

    setQuickBusy(true);
    setQuickError(null);
    setQuickInfo("Hızlı grup dersi oluşturuluyor…");
    const res = await createLesson(fd);
    if ("error" in res) {
      setQuickError(res.error || "Hızlı grup dersi oluşturulamadı.");
      setQuickInfo(null);
      setQuickBusy(false);
      return;
    }
    setQuickInfo("Ders oluşturuldu, takvim güncelleniyor…");
    await fetchSnapshot();
    setQuickBusy(false);
    setQuickCreateAt(null);
    setQuickInfo(null);
    setActionMessage("Hızlı grup dersi oluşturuldu.");
    setRecentCreatedRange({
      dayKey: isoToZonedDateKey(startIso),
      startMinutes: isoToZonedClockMinutesFromMidnight(startIso),
      endMinutes: isoToZonedClockMinutesFromMidnight(endIso),
      expiresAt: Date.now() + 3500,
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem("calendar.quick.groupCoachId", groupForm.coachId || "");
      window.localStorage.setItem("calendar.quick.groupDuration", groupForm.durationMinutes || "60");
    }
  }

  async function submitOneClickPrivateLesson() {
    if (!quickCreateAt) return;
    const active = quickPackages.filter((p) => p.isActive && p.remainingLessons > 0);
    if (active.length !== 1 || !active[0].coachId) {
      setQuickError("Özel ders planlamak için koç seçmelisiniz.");
      return;
    }
    if (!privateTimeValidation.ok) {
      setQuickError(privateTimeValidation.message);
      return;
    }
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString());
    const slotClock = formatLessonTimeTr(quickCreateAt.toISOString());
    const startMin =
      parseClockToMinutes(privateForm.startClock || slotClock) || parseClockToMinutes(slotClock) || 0;
    const endMin = parseClockToMinutes(privateForm.endClock || minutesToClock(startMin + 60)) || (startMin + 60);
    const duration = Math.max(15, endMin - startMin);
    const fd = new FormData();
    fd.append("packageId", active[0].id);
    fd.append("lessonDate", lessonDate);
    fd.append("startClock", minutesToClock(startMin));
    fd.append("durationMinutes", String(duration));
    fd.append("coachId", active[0].coachId);

    setQuickBusy(true);
    setQuickError(null);
    setQuickInfo("Hızlı özel ders planlanıyor…");
    const res = await createPrivateLessonSession(fd);
    if ("error" in res) {
      setQuickError(res.error || "Hızlı özel ders planlanamadı.");
      setQuickInfo(null);
      setQuickBusy(false);
      return;
    }
    setQuickInfo("Özel ders planlandı, takvim güncelleniyor…");
    await fetchSnapshot();
    setQuickBusy(false);
    setQuickCreateAt(null);
    setQuickInfo(null);
    setActionMessage("Hızlı özel ders planlandı.");
    setRecentCreatedRange({
      dayKey: lessonDate,
      startMinutes: startMin,
      endMinutes: endMin,
      expiresAt: Date.now() + 3500,
    });
  }

  async function handleQuickCancel(item: WeeklyLessonScheduleItem) {
    const ok = window.confirm("Bu dersi iptal etmek istiyor musunuz?");
    if (!ok) return;
    setActionBusy(item.id);
    const res =
      item.sourceType === "private"
        ? await cancelPrivateLessonSession(item.id)
        : await cancelLesson(item.id);
    if ("error" in res) setActionMessage(res.error || "Ders iptal edilemedi.");
    else {
      setActionMessage("Ders iptal edildi.");
      await fetchSnapshot();
      if (selected?.id === item.id) setSelected(null);
    }
    setActionBusy(null);
  }

  async function handleQuickHardDelete(item: WeeklyLessonScheduleItem) {
    if (item.sourceType !== "group") return;
    const ok = window.confirm("Bu dersi tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.");
    if (!ok) return;
    setActionBusy(item.id);
    const res = await hardDeleteLesson(item.id);
    if ("error" in res) setActionMessage(res.error || "Ders kalıcı silinemedi.");
    else {
      setActionMessage("Ders kalıcı olarak silindi.");
      await fetchSnapshot();
      if (selected?.id === item.id) setSelected(null);
    }
    setActionBusy(null);
  }

  async function handleCreateLocation() {
    const name = newLocationName.trim();
    if (!name) {
      setQuickError("Lokasyon adı zorunludur.");
      return;
    }
    setLocationBusy(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("color", newLocationColor);
    const res = await createLocationAction(fd);
    if ("error" in res) {
      setQuickError(res.error || "Lokasyon oluşturulamadı.");
      setLocationBusy(false);
      return;
    }
    const listRes = await listLocationsForActor();
    if (!("error" in listRes)) {
      const nextLocations = (listRes.locations || []).map((row) => ({ id: row.id, name: row.name, color: row.color }));
      setLocationOptions(nextLocations);
      const created = nextLocations.find((loc) => loc.name.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));
      if (created) {
        setGroupForm((prev) => ({ ...prev, location: created.name }));
        setPrivateForm((prev) => ({ ...prev, location: created.name }));
      }
    }
    setNewLocationName("");
    setQuickError(null);
    setQuickInfo("Lokasyon eklendi.");
    setLocationBusy(false);
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 border-b border-white/5 pb-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Operasyon ekranı</p>
          <h1 className="ui-h1">
            Haftalık <span className="text-[#7c3aed]">ders programı</span>
          </h1>
          <p className="ui-lead max-w-3xl break-words normal-case tracking-normal">
            Grup dersleri ve özel ders planlarını tek çizelgede görün. Filtrelerle haftayı, dersi ve koçu daraltın.
          </p>
        </div>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-[#121215] to-[#171721] p-3 shadow-[0_8px_26px_-22px_rgba(124,58,237,0.45)] lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="mb-1 text-[9px] font-black uppercase tracking-wider text-gray-500">Hafta</p>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftWeek(-7)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2.5 text-gray-300 sm:hover:bg-white/5"
                aria-label="Önceki hafta"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <input
                type="date"
                value={utcDateKeyFromIso(weekStart)}
                onChange={(e) => setWeekStart(getWeekStartMondayIso(e.target.value))}
                className="ui-input min-h-10"
              />
              <button
                type="button"
                onClick={() => shiftWeek(7)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2.5 text-gray-300 sm:hover:bg-white/5"
                aria-label="Sonraki hafta"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(getWeekStartMondayIso())}
                className="inline-flex min-h-10 items-center rounded-xl border border-[#7c3aed]/50 bg-[#7c3aed]/25 px-2.5 text-[10px] font-black uppercase tracking-wide text-[#e8ddff] transition sm:hover:bg-[#7c3aed]/35"
              >
                Bu hafta
              </button>
            </div>
            <p className="mt-1 text-[10px] font-bold text-gray-500">{weekLabel}</p>
          </div>

          <div className="lg:col-span-4">
            <SelectPremium
              label="Ders tipi"
              value={lessonType}
              onChange={(next) => setLessonType(next as WeeklyLessonTypeFilter)}
            >
              <option value="all">Hepsi</option>
              <option value="group">Sadece grup dersleri</option>
              <option value="private">Sadece özel dersler</option>
            </SelectPremium>
          </div>

          <div className="lg:col-span-2">
            <SelectPremium label="Koç" value={coachId} onChange={setCoachId}>
              <option value="">Tüm koçlar</option>
              {(snapshot?.coachOptions || []).map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.full_name}
                </option>
              ))}
            </SelectPremium>
          </div>

          <label className="lg:col-span-1">
            <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Lokasyon</span>
            <div className="relative">
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="ui-select min-h-10 w-full appearance-none rounded-xl border-white/10 bg-[#17171f] pr-10"
              >
                <option value="">Tüm lokasyonlar</option>
                {locationOptions.map((loc) => (
                  <option key={loc.id} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c4b5fd]"
              />
              {selectedLocationColor ? (
                <span
                  className="pointer-events-none absolute right-8 top-1/2 size-2.5 -translate-y-1/2 rounded-full border border-white/40"
                  style={{ backgroundColor: selectedLocationColor }}
                  aria-hidden
                />
              ) : null}
            </div>
            {locationOptions.length === 0 ? (
              <p className="mt-1 text-[10px] font-bold text-amber-300/90">Tanımlı lokasyon yok. Hızlı planlama penceresinden lokasyon ekleyin.</p>
            ) : null}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#111117] p-2 sm:grid-cols-4">
          <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
            <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">Toplam Ders</p>
            <p className="mt-0.5 text-base font-black tabular-nums text-white">{summary.totalLessons}</p>
          </div>
          <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1.5">
            <p className="text-[8px] font-black uppercase tracking-wider text-indigo-200/80">Grup Dersi</p>
            <p className="mt-0.5 text-base font-black tabular-nums text-indigo-100">{summary.groupLessons}</p>
          </div>
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5">
            <p className="text-[8px] font-black uppercase tracking-wider text-emerald-200/80">Özel Ders</p>
            <p className="mt-0.5 text-base font-black tabular-nums text-emerald-100">{summary.privateLessons}</p>
          </div>
          <div className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2.5 py-1.5">
            <p className="text-[8px] font-black uppercase tracking-wider text-[#d8cbff]/85">Aktif Koç</p>
            <p className="mt-0.5 text-base font-black tabular-nums text-[#f0e9ff]">{summary.activeCoachCount}</p>
          </div>
        </div>
      </header>

      {error ? <Notification message={error} variant="error" /> : null}
      {actionMessage ? (
        <Notification
          message={actionMessage}
          variant={actionMessage.toLowerCase().includes("iptal") ? "success" : "info"}
        />
      ) : null}

      {loading ? (
        <div className="flex min-h-[45dvh] items-center justify-center">
          <Loader2 className="animate-spin text-[#7c3aed]" size={40} aria-hidden />
        </div>
      ) : (
        <>
          {focusedDayKey ? (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-[#121215] px-3 py-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-gray-200">
                Gün detayı · {dayTitle(shownDayStarts[0] || dayStarts[0])}
              </p>
              <button
                type="button"
                onClick={() => setFocusedDayKey(null)}
                className="ui-btn-ghost min-h-10 px-3 text-[10px]"
              >
                Haftalık görünüme dön
              </button>
            </div>
          ) : null}
          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#111114] md:block">
            <div className="min-w-[1120px]">
              <div
                className="grid border-b border-white/10"
                style={{ gridTemplateColumns: `88px repeat(${shownDayStarts.length}, minmax(140px, 1fr))` }}
              >
                <div className="sticky left-0 z-30 bg-[#0f0f13] px-2 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  Saat
                </div>
                {shownDayStarts.map((dayIso) => {
                  const isToday = isoToZonedDateKey(dayIso) === todayKey;
                  return (
                    <div
                      key={dayIso}
                      onClick={() => setFocusedDayKey(isoToZonedDateKey(dayIso))}
                      className={`border-l px-3 py-3 text-[11px] font-black uppercase tracking-wide ${
                        isToday
                          ? "border-[#7c3aed]/45 bg-gradient-to-b from-[#7c3aed]/18 to-[#7c3aed]/6 text-[#f0e9ff]"
                          : "border-white/10 bg-white/[0.01] text-white/90"
                      } ${focusedDayKey ? "cursor-default" : "cursor-pointer hover:bg-white/[0.03]"}`}
                    >
                      {dayTitle(dayIso)}
                      {isToday ? (
                        <span className="ml-2 rounded-md border border-[#7c3aed]/45 bg-[#7c3aed]/15 px-1.5 py-0.5 text-[9px]">
                          Bugün
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div
                className="relative grid"
                style={{ gridTemplateColumns: `88px repeat(${shownDayStarts.length}, minmax(140px, 1fr))` }}
              >
                {weekContainsToday && nowTop != null ? (
                  <div
                    className="pointer-events-none absolute left-[88px] right-0 z-20 border-t border-rose-300/80"
                    style={{ top: `${nowTop}%` }}
                  >
                    <span className="absolute -left-12 -top-2 rounded bg-rose-500/90 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                      Şu an
                    </span>
                  </div>
                ) : null}

                <div className="sticky left-0 z-20 relative border-r border-white/10 bg-[#0d0d11]">
                  {hourRows.map((h) => (
                    <div
                      key={h}
                      className={`h-16 border-b px-2 pt-1 text-[10px] font-black tabular-nums ${
                        h % 2 === 0 ? "border-white/10 bg-white/[0.028] text-gray-300" : "border-white/5 text-gray-500"
                      }`}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {shownDayStarts.map((dayIso) => {
                  const dayKey = isoToZonedDateKey(dayIso);
                  const rows = itemsByDay.get(dayKey) || [];
                  const laidOutRows = computeDayOverlapLayout(rows);
                  const showRecentPulse =
                    recentCreatedRange &&
                    recentCreatedRange.dayKey === dayKey &&
                    recentCreatedRange.expiresAt > now.getTime();
                  const pulseTop = showRecentPulse
                    ? ((recentCreatedRange.startMinutes - GRID_START_HOUR * 60) / DAY_MINUTES) * 100
                    : 0;
                  const pulseHeight = showRecentPulse
                    ? Math.max(((recentCreatedRange.endMinutes - recentCreatedRange.startMinutes) / DAY_MINUTES) * 100, 3.2)
                    : 0;
                  return (
                    <div
                      key={dayIso}
                      className={`relative border-r last:border-r-0 ${
                        isoToZonedDateKey(dayIso) === todayKey
                          ? "border-[#7c3aed]/35 bg-[#7c3aed]/[0.06]"
                          : "border-white/10 bg-white/[0.01]"
                      }`}
                      style={{ height: `${GRID_CONTAINER_HEIGHT_REM}rem` }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("[data-lesson-card='1']")) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const y = e.clientY - rect.top;
                        const totalRows = hourRows.length;
                        const rowHeight = rect.height / totalRows;
                        const rowIndex = Math.max(0, Math.min(totalRows - 1, Math.floor(y / rowHeight)));
                        const selectedHour = GRID_START_HOUR + rowIndex;
                        const anchorIso = wallClockInZoneToUtcIso(dayKey, `${String(selectedHour).padStart(2, "0")}:00`);
                        if (anchorIso) setQuickCreateAt(new Date(anchorIso));
                      }}
                    >
                      {showRecentPulse ? (
                        <div
                          className="pointer-events-none absolute left-1.5 right-1.5 z-10 rounded-2xl border border-[#7c3aed]/45 bg-[#7c3aed]/20 animate-pulse"
                          style={{ top: `${pulseTop}%`, height: `${pulseHeight}%` }}
                        />
                      ) : null}
                      {hourRows.map((h) => (
                        <div
                          key={h}
                          className={`h-16 border-b ${h % 2 === 0 ? "border-white/10 bg-white/[0.018]" : "border-white/5"}`}
                        />
                      ))}
                      {(() => {
                        const grouped = new Map<string, DayLayoutItem[]>();
                        for (const row of laidOutRows) {
                          const key = row.groupId;
                          const prev = grouped.get(key) || [];
                          prev.push(row);
                          grouped.set(key, prev);
                        }

                        const renderRows: Array<
                          | { kind: "lesson"; row: DayLayoutItem }
                          | { kind: "group"; rows: DayLayoutItem[] }
                        > = [];

                        for (const rowsInGroup of grouped.values()) {
                          const ordered = [...rowsInGroup].sort((a, b) => a.laneIndex - b.laneIndex);
                          const shouldCompact = !focusedDayKey && (ordered[0]?.groupSize || 0) > 2;
                          if (shouldCompact) {
                            if (ordered[0]) renderRows.push({ kind: "lesson", row: { ...ordered[0], laneIndex: 0, laneCount: 2 } });
                            renderRows.push({ kind: "group", rows: ordered.slice(1) });
                          } else {
                            for (const row of ordered) renderRows.push({ kind: "lesson", row });
                          }
                        }

                        return renderRows.map((entry, idx) => {
                          if (entry.kind === "group") {
                            const anchor = entry.rows[0];
                            const { top, height } = itemTopAndHeight(anchor.item);
                            return (
                              <button
                                key={`group-${dayKey}-${idx}`}
                                type="button"
                                onClick={() => {
                                  setOverlapListItems(entry.rows.map((r) => r.item));
                                  setOverlapListTitle(
                                    `${dayTitle(dayIso)} · ${formatLessonTimeTr(anchor.item.startsAt)} - ${formatLessonTimeTr(anchor.item.endsAt)}`
                                  );
                                  setOverlapListOpen(true);
                                }}
                                className="absolute rounded-2xl border border-amber-300/40 bg-amber-500/20 px-2 py-2 text-left text-[10px] font-black uppercase tracking-wide text-amber-50"
                                style={{
                                  top: `${top}%`,
                                  height: `${height}%`,
                                  width: "calc(50% - 0.5rem)",
                                  left: "calc(50% + 0.25rem)",
                                }}
                              >
                                +{entry.rows.length} ders
                              </button>
                            );
                          }

                          const { item, laneIndex, laneCount } = entry.row;
                        const { top, height } = itemTopAndHeight(item);
                        const isGroup = item.sourceType === "group";
                        const coachLabel = item.coachName || "Koç atanmadı";
                        const locationLabel = item.location || "Lokasyon belirtilmedi";
                        const isCompactCard = !focusedDayKey && (laneCount > 1 || height < 11);
                        const widthPercent = 100 / laneCount;
                        const leftPercent = laneIndex * widthPercent;
                        const locationStyle = locationCardStyle(item.locationColor);
                        return (
                          <div
                            key={`${item.sourceType}-${item.id}`}
                            onClick={() => setSelected(item)}
                            data-lesson-card="1"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelected(item);
                              }
                            }}
                          title={`${item.sourceType === "group" ? "Grup Dersi" : "Özel Ders"} | ${item.title} | ${formatLessonTimeTr(item.startsAt)} - ${formatLessonTimeTr(item.endsAt)} | Koç: ${coachLabel}${item.location ? ` | Lokasyon: ${item.location}` : ""}`}
                          className={`group absolute min-h-[60px] overflow-hidden rounded-2xl border px-2 py-2 text-left shadow-[0_12px_28px_-16px_rgba(0,0,0,0.95)] transition-all duration-150 sm:hover:-translate-y-0.5 ${
                              locationStyle
                                ? "text-white"
                                : isGroup
                                  ? "border-indigo-400/55 bg-gradient-to-b from-indigo-500/22 to-indigo-500/14 text-indigo-50 sm:hover:shadow-[0_0_0_1px_rgba(129,140,248,0.55),0_18px_30px_-16px_rgba(99,102,241,0.9)]"
                                  : "border-emerald-400/55 border-dashed bg-gradient-to-b from-emerald-500/22 to-emerald-500/14 text-emerald-50 sm:hover:shadow-[0_0_0_1px_rgba(52,211,153,0.55),0_18px_30px_-16px_rgba(16,185,129,0.9)]"
                            }`}
                            style={{
                              top: `${top}%`,
                              height: `${height}%`,
                              width: `calc(${widthPercent}% - 0.5rem)`,
                              left: `calc(${leftPercent}% + 0.25rem)`,
                              ...(locationStyle || {}),
                            }}
                          >
                            {item.locationColor ? (
                              <span
                                className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl opacity-90"
                                style={{ backgroundColor: item.locationColor }}
                                aria-hidden
                              />
                            ) : null}
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                              {isGroup ? <Users size={11} aria-hidden /> : <User size={11} aria-hidden />}
                              <span
                                className={`rounded px-1 py-0.5 ${
                                  isGroup ? "bg-indigo-950/45 text-indigo-100" : "bg-emerald-950/45 text-emerald-100"
                                }`}
                              >
                                {isGroup ? "Grup Dersi" : "Özel Ders"}
                              </span>
                            </p>
                            <p className={`mt-1 overflow-hidden text-[11px] font-black leading-tight text-white ${isCompactCard ? "line-clamp-1" : "line-clamp-2"}`}>
                              {item.title}
                            </p>
                            <p className="mt-1 line-clamp-1 overflow-hidden text-[10px] font-bold text-white/85">
                              {formatLessonTimeTr(item.startsAt)} - {formatLessonTimeTr(item.endsAt)}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-white/90" title={`Koç: ${coachLabel}`}>
                              <User2 size={11} aria-hidden className="shrink-0 text-white/70" />
                              <span className="min-w-0 truncate">Koç: {coachLabel}</span>
                            </p>
                            {!isCompactCard || focusedDayKey ? (
                              <p className="mt-1 inline-flex max-w-full items-center gap-1 overflow-hidden text-[10px] font-black text-white/85">
                                <MapPin size={11} aria-hidden className="shrink-0 text-white/70" />
                                <span className="line-clamp-1 overflow-hidden">Lokasyon: {locationLabel}</span>
                              </p>
                            ) : null}
                            <div className="mt-2 hidden flex-wrap gap-1.5 opacity-0 transition group-hover:flex group-hover:opacity-100">
                              <Link
                                href={item.detailHref}
                                className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white/90"
                              >
                                Detaya Git
                              </Link>
                              <Link
                                href={item.detailHref}
                                className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white/90"
                              >
                                Düzenle
                              </Link>
                              <Link
                                href={
                                  item.sourceType === "group"
                                    ? `/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${item.id}`
                                    : item.detailHref
                                }
                                className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white/90"
                              >
                                Yoklama Aç
                              </Link>
                              <button
                                type="button"
                                disabled={actionBusy === item.id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void handleQuickCancel(item);
                                }}
                                className="rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-100 disabled:opacity-50"
                              >
                                İptal Et
                              </button>
                              {item.sourceType === "group" ? (
                                <button
                                  type="button"
                                  disabled={actionBusy === item.id}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleQuickHardDelete(item);
                                  }}
                                  className="rounded-md border border-rose-500/55 bg-rose-600/30 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-50 disabled:opacity-50"
                                >
                                  Kalıcı Sil
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                        });
                      })()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {shownDayStarts.map((dayIso) => {
              const rows = itemsByDay.get(isoToZonedDateKey(dayIso)) || [];
              return (
                <section key={dayIso} className="rounded-2xl border border-white/10 bg-[#121215] p-4">
                  <h2 className="text-xs font-black uppercase tracking-wide text-white">{dayTitle(dayIso)}</h2>
                  {rows.length === 0 ? (
                    <p className="mt-2 text-[11px] font-bold text-gray-500">Ders yok.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {rows.map((item) => (
                          <button
                            key={`${item.sourceType}-${item.id}`}
                            type="button"
                            onClick={() => setSelected(item)}
                            className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-left"
                          >
                            <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                              {item.sourceType === "group" ? "Grup Dersi" : "Özel Ders"} · {formatLessonTimeTr(item.startsAt)}
                            </p>
                            <p className="mt-1 text-sm font-black text-white">{item.title}</p>
                            <p className="text-[11px] font-semibold text-gray-300">Koç: {item.coachName || "Koç atanmadı"}</p>
                            <p className="text-[11px] font-bold text-gray-500">Lokasyon: {item.location || "Lokasyon belirtilmedi"}</p>
                          </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {selected ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onClick={() => setSelected(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#17171d] p-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                  selected.sourceType === "group"
                    ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
                    : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                }`}
              >
                {selected.sourceType === "group" ? "Grup Dersi" : "Özel Ders"}
              </span>
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300">
                {lessonStatusLabelTr(selected.status)}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-white">{selected.title}</h3>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {selected.sourceType === "group" ? "Grup dersi oturumu" : "Özel ders oturumu"}
            </p>
            {selected.subtitle ? <p className="mt-2 text-sm font-bold text-gray-400">{selected.subtitle}</p> : null}

            <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-4 text-[12px] font-bold text-gray-300">
              <p className="flex items-center gap-2">
                <Clock3 size={14} aria-hidden className="text-[#c4b5fd]" />
                {formatLessonDateTimeTr(selected.startsAt)} – {formatLessonDateTimeTr(selected.endsAt)}
              </p>
              <p className="flex items-center gap-2">
                <User2 size={14} aria-hidden className="text-[#c4b5fd]" />
                Koç: {selected.coachName || "Koç atanmadı"}
              </p>
              <p className="flex items-center gap-2">
                {selected.sourceType === "group" ? (
                  <Users size={14} aria-hidden className="text-[#c4b5fd]" />
                ) : (
                  <User size={14} aria-hidden className="text-[#c4b5fd]" />
                )}
                Ders tipi: {selected.sourceType === "group" ? "Grup Dersi" : "Özel Ders"}
              </p>
              <p className="flex items-center gap-2">
                <Users size={14} aria-hidden className="text-[#c4b5fd]" />
                Katılımcı: {selected.participantCount}
              </p>
              <p className="flex items-center gap-2">
                <MapPin size={14} aria-hidden className="text-[#c4b5fd]" />
                {selected.location || "Lokasyon yok"}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Sporcu listesi</p>
              <p className="mt-1 text-sm font-bold text-gray-300">
                {selected.participantNames.length > 0 ? selected.participantNames.join(", ") : "Katılımcı yok"}
              </p>
            </div>

            {selected.note ? (
              <div className="mt-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Not</p>
                <p className="mt-1 text-sm font-bold text-gray-300">{selected.note}</p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleQuickCancel(selected)}
                disabled={actionBusy === selected.id}
                className="rounded-lg border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-amber-100 disabled:opacity-50"
              >
                Dersi İptal Et
              </button>
              {selected.sourceType === "group" ? (
                <button
                  type="button"
                  onClick={() => void handleQuickHardDelete(selected)}
                  disabled={actionBusy === selected.id}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/20 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-rose-100 disabled:opacity-50"
                >
                  Kalıcı Sil
                </button>
              ) : null}
              <button type="button" onClick={() => setSelected(null)} className="ui-btn-ghost min-h-11 px-4">
                Kapat
              </button>
              <Link href={selected.detailHref} className="ui-btn-primary min-h-11 px-5">
                İlgili detay sayfasına git
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {overlapListOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setOverlapListOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#17171d] p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-wider text-[#c4b5fd]">Çakışan dersler</p>
            <h3 className="mt-2 text-sm font-black text-white">{overlapListTitle}</h3>
            <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
              {overlapListItems.map((item) => (
                  <button
                    key={`ov-${item.id}`}
                    type="button"
                    onClick={() => {
                      setSelected(item);
                      setOverlapListOpen(false);
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-left"
                    style={locationCardStyle(item.locationColor)}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                      {item.sourceType === "group" ? "Grup Dersi" : "Özel Ders"} · {formatLessonTimeTr(item.startsAt)} - {formatLessonTimeTr(item.endsAt)}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm font-black text-white">{item.title}</p>
                    <p className="line-clamp-1 text-[11px] font-semibold text-white/90" title={`Koç: ${item.coachName || "Koç atanmadı"}`}>
                      Koç: {item.coachName || "Koç atanmadı"}
                    </p>
                    <p className="line-clamp-1 text-[11px] font-bold text-white/80">Lokasyon: {item.location || "Lokasyon belirtilmedi"}</p>
                  </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setOverlapListOpen(false)} className="ui-btn-ghost min-h-11 px-4">
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quickCreateAt ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onClick={() => setQuickCreateAt(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#17171d] p-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c4b5fd]">Hızlı planlama</p>
            <h3 className="mt-2 text-xl font-black uppercase tracking-tight text-white">Takvimden ders oluştur</h3>
            <p className="mt-2 text-sm font-bold text-gray-400">
              Seçilen zaman: <span className="text-white">{quickCreateDateLabel}</span> ·{" "}
              <span className="text-white">{quickCreateTimeLabel}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setQuickMode("group")}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
                  quickMode === "group"
                    ? "border-indigo-400/40 bg-indigo-500/20 text-indigo-100"
                    : "border-white/15 bg-white/5 text-gray-300"
                }`}
              >
                Grup Dersi
              </button>
              <button
                type="button"
                onClick={() => setQuickMode("private")}
                className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
                  quickMode === "private"
                    ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
                    : "border-white/15 bg-white/5 text-gray-300"
                }`}
              >
                Özel Ders
              </button>
            </div>
            {quickError ? <div className="mt-3"><Notification message={quickError} variant="error" /></div> : null}
            {quickInfo ? (
              <p className="mt-3 rounded-lg border border-[#7c3aed]/25 bg-[#7c3aed]/10 px-3 py-2 text-[11px] font-semibold text-[#ddd6fe]">
                {quickInfo}
              </p>
            ) : null}
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c4b5fd]">⚡ Hızlı Oluştur</p>
              {quickMode === "group" ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={quickGroupTitle}
                    onChange={(e) => setQuickGroupTitle(e.target.value)}
                    placeholder="Ders adı (opsiyonel)"
                    className="ui-input"
                  />
                  <p className="text-[11px] font-semibold text-gray-400">
                    Son koç + varsayılan süre ile tek tık oluşturma.
                  </p>
                  <button
                    type="button"
                    disabled={quickBusy || !groupForm.coachId || !groupTimeValidation.ok}
                    onClick={() => void submitOneClickGroupLesson()}
                    className="rounded-lg border border-indigo-400/40 bg-indigo-500/25 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-indigo-100 disabled:opacity-50"
                  >
                    {quickBusy ? "Oluşturuluyor…" : `⚡ ${groupForm.startClock || "--:--"} - ${groupForm.endClock || "--:--"} ders oluştur`}
                  </button>
                </div>
              ) : canQuickPrivateCreate ? (
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] font-semibold text-gray-400">
                    Tek aktif paket bulundu. Paket ve koç otomatik seçilerek tek tık planlama yapılır.
                  </p>
                  <button
                    type="button"
                    disabled={quickBusy}
                    onClick={() => void submitOneClickPrivateLesson()}
                    className="rounded-lg border border-emerald-400/40 bg-emerald-500/25 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-100 disabled:opacity-50"
                  >
                    {quickBusy ? "Planlanıyor…" : `⚡ ${privateForm.startClock || "--:--"} - ${privateForm.endClock || "--:--"} özel ders`}
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[11px] font-semibold text-gray-500">
                  Hızlı özel ders için tek aktif paket + paket koçu gereklidir. Manuel formu kullanabilirsiniz.
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-white/10" />
            {quickBusy ? (
              <p className="mt-3 text-[11px] font-semibold text-gray-400">İşlem hazırlanıyor…</p>
            ) : quickMode === "group" ? (
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Ders adı</span>
                  <input
                    value={groupForm.title}
                    onChange={(e) => setGroupForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Örn. Teknik ve pas çalışması"
                    className="ui-input"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Koç</span>
                    <select
                      value={groupForm.coachId}
                      onChange={(e) => setGroupForm((p) => ({ ...p, coachId: e.target.value }))}
                      className="ui-select"
                    >
                      {quickCoachOptions.length === 0 ? <option value="">Koç bulunamadı</option> : null}
                      {quickCoachOptions.map((coach) => (
                        <option key={coach.id} value={coach.id}>
                          {coach.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Başlangıç saati</span>
                    <input
                      type="time"
                      step={900}
                      value={groupForm.startClock}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setGroupForm((p) => ({ ...p, startClock: nextStart }));
                        syncDurationFromRange(nextStart, groupForm.endClock);
                      }}
                      className="ui-input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Bitiş saati</span>
                    <input
                      type="time"
                      step={900}
                      value={groupForm.endClock}
                      onChange={(e) => {
                        const nextEnd = e.target.value;
                        setGroupForm((p) => ({ ...p, endClock: nextEnd }));
                        syncDurationFromRange(groupForm.startClock, nextEnd);
                      }}
                      className="ui-input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Süre (dk)</span>
                    <input
                      type="number"
                      min={15}
                      step={15}
                      value={groupForm.durationMinutes}
                      onChange={(e) => {
                        const nextDuration = e.target.value;
                        setGroupForm((p) => ({ ...p, durationMinutes: nextDuration }));
                        syncEndFromDuration(groupForm.startClock, nextDuration);
                      }}
                      className="ui-input"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Kapasite</span>
                    <input
                      type="number"
                      min={1}
                      value={groupForm.capacity}
                      onChange={(e) => setGroupForm((p) => ({ ...p, capacity: e.target.value }))}
                      className="ui-input"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Lokasyon</span>
                    {locationOptions.length > 0 ? (
                      <select
                        value={groupForm.location}
                        onChange={(e) => setGroupForm((p) => ({ ...p, location: e.target.value }))}
                        className="ui-select"
                      >
                        {locationOptions.map((loc) => (
                          <option key={loc.id} value={loc.name}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100">
                        Kayıtlı lokasyon yok. Aşağıdan yeni lokasyon ekleyin.
                      </p>
                    )}
                  </label>
                </div>
                {inlineTimePreview ? (
                  <p className="rounded-lg border border-[#7c3aed]/25 bg-[#7c3aed]/10 px-3 py-2 text-[11px] font-semibold text-[#ddd6fe]">
                    {inlineTimePreview}
                  </p>
                ) : null}
                {!groupTimeValidation.ok ? (
                  <p className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-200">
                    {groupTimeValidation.message}
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void submitQuickGroupLesson()}
                    disabled={quickBusy || !groupTimeValidation.ok}
                    className="rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-indigo-100 disabled:opacity-50"
                  >
                    {quickBusy ? "Kaydediliyor…" : "Grup dersini oluştur"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {!quickHasActivePackage ? (
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-3">
                    <p className="text-[12px] font-black text-amber-100">Planlanabilir aktif paket yok</p>
                    <p className="mt-1 text-[11px] font-semibold text-amber-100/90">
                      Bu zaman için planlanabilecek aktif özel ders paketi bulunmuyor.
                    </p>
                  </div>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Aktif paket</span>
                      <select
                        value={privateForm.packageId}
                        onChange={(e) => {
                          const selected = quickPackages.find((p) => p.id === e.target.value);
                          setPrivateForm((p) => ({
                            ...p,
                            packageId: e.target.value,
                                coachId: selected?.coachId || "",
                          }));
                        }}
                        className="ui-select"
                      >
                        {quickPackages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.athleteName} | {pkg.packageName} | Kalan {pkg.remainingLessons} ders
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Başlangıç saati</span>
                        <input
                          type="time"
                          step={900}
                          value={privateForm.startClock}
                          onChange={(e) => {
                            const nextStart = e.target.value;
                            setPrivateForm((p) => ({ ...p, startClock: nextStart }));
                            syncPrivateDurationFromRange(nextStart, privateForm.endClock);
                          }}
                          className="ui-input"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Bitiş saati</span>
                        <input
                          type="time"
                          step={900}
                          value={privateForm.endClock}
                          onChange={(e) => {
                            const nextEnd = e.target.value;
                            setPrivateForm((p) => ({ ...p, endClock: nextEnd }));
                            syncPrivateDurationFromRange(privateForm.startClock, nextEnd);
                          }}
                          className="ui-input"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Süre (dk)</span>
                        <input
                          type="number"
                          min={15}
                          step={15}
                          value={privateForm.durationMinutes}
                          onChange={(e) => {
                            const nextDuration = e.target.value;
                            setPrivateForm((p) => ({ ...p, durationMinutes: nextDuration }));
                            syncPrivateEndFromDuration(privateForm.startClock, nextDuration);
                          }}
                          className="ui-input"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Koç</span>
                        <select
                          value={privateForm.coachId}
                          onChange={(e) => setPrivateForm((p) => ({ ...p, coachId: e.target.value }))}
                          className="ui-select"
                        >
                          <option value="">Koç seçin</option>
                          {quickCoachOptions.map((coach) => (
                            <option key={coach.id} value={coach.id}>
                              {coach.full_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-gray-500">Lokasyon</span>
                        {locationOptions.length > 0 ? (
                          <select
                            value={privateForm.location}
                            onChange={(e) => setPrivateForm((p) => ({ ...p, location: e.target.value }))}
                            className="ui-select"
                          >
                            {locationOptions.map((loc) => (
                              <option key={loc.id} value={loc.name}>
                                {loc.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-100">
                            Kayıtlı lokasyon yok. Aşağıdan yeni lokasyon ekleyin.
                          </p>
                        )}
                      </label>
                    </div>
                    {!privateTimeValidation.ok ? (
                      <p className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold text-rose-200">
                        {privateTimeValidation.message}
                      </p>
                    ) : null}
                    {selectedPackage() ? (
                      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[11px]">
                        <p className="font-black text-emerald-100">Seçili paket</p>
                        <p className="mt-1 font-semibold text-emerald-50/95">
                          {selectedPackage()?.athleteName} · {selectedPackage()?.packageName}
                        </p>
                        <p className="mt-0.5 font-semibold text-emerald-100/80">
                          Kalan ders: {selectedPackage()?.remainingLessons}
                        </p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void submitQuickPrivateLesson()}
                        disabled={quickBusy}
                        className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-emerald-100 disabled:opacity-50"
                      >
                        {quickBusy ? "Kaydediliyor…" : "Özel dersi planla"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c4b5fd]">Lokasyon ekle</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]">
                <input
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="Örn. Ana Salon"
                  className="ui-input"
                />
                <input
                  type="color"
                  value={newLocationColor}
                  onChange={(e) => setNewLocationColor(e.target.value)}
                  className="ui-input h-11 p-1"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateLocation()}
                  disabled={locationBusy}
                  className="ui-btn-ghost min-h-11 px-4"
                >
                  {locationBusy ? "Ekleniyor..." : "Lokasyon ekle"}
                </button>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setQuickCreateAt(null)}
                className="ui-btn-ghost min-h-11 px-4"
              >
                Kapat
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {!loading && !error && emptyState ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-gradient-to-b from-[#101014] to-[#13131a] p-10 text-center">
          <CalendarDays size={38} className="mx-auto text-gray-600" aria-hidden />
          <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-gray-300">{emptyState.title}</p>
          <p className="mt-2 text-[12px] font-bold text-gray-500">{emptyState.description}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLessonType("all");
                setCoachId("");
                setLocation("");
              }}
              className="ui-btn-ghost inline-flex min-h-11 items-center px-4"
            >
              Filtreleri temizle
            </button>
            <Link href="/dersler" className="ui-btn-primary inline-flex min-h-11 items-center px-4">
              Ders oluştur
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
