"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { cancelLesson, createLesson, hardDeleteLesson } from "@/lib/actions/lessonActions";
import {
  createPrivateLessonSession,
  cancelPrivateLessonSession,
  markPrivateLessonSessionCompletedFromSchedule,
} from "@/lib/actions/privateLessonSessionActions";
import {
  runPrivateLessonCreateWithSlotConfirm,
  type PrivateLessonSlotOverlapConfirmState,
} from "@/lib/privateLessons/privateLessonSlotOverlapConfirmFlow";
import PrivateLessonSlotOverlapConfirmModal from "@/components/privateLessons/PrivateLessonSlotOverlapConfirmModal";
import PrivateLessonParallelMetricsStrip from "@/components/privateLessons/PrivateLessonParallelMetricsStrip";
import { listPrivateLessonPackagesForManagement } from "@/lib/actions/privateLessonPackageActions";
import { createLocationAction, listLocationsForActor } from "@/lib/actions/locationActions";
import { listLessonsSnapshot, listWeeklyLessonScheduleSnapshot } from "@/lib/actions/snapshotActions";
import { formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import {
  SCHEDULE_APP_TIME_ZONE,
  isoToZonedClockMinutesFromMidnight,
  isoToZonedDateKey,
  wallClockInZoneToUtcIso,
} from "@/lib/schedule/scheduleWallTime";
import { getWeekDayStarts, getWeekStartMondayIso } from "@/lib/schedule/weeklySchedule";
import type { WeeklyLessonScheduleItem, WeeklyLessonScheduleSnapshot, WeeklyLessonTypeFilter } from "@/lib/types";
import type { PrivateLessonPackage } from "@/lib/types";

import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  dayTitle,
  minutesToClock,
  parseClockToMinutes,
} from "./_utils/scheduleGrid";
import { LessonDetailModal } from "./_components/LessonDetailModal";
import { OverlapListModal } from "./_components/OverlapListModal";
import { QuickCreateLessonModal } from "./_components/QuickCreateLessonModal";
import { WeeklyMobileList } from "./_components/WeeklyMobileList";
import { WeeklyScheduleGrid } from "./_components/WeeklyScheduleGrid";
import { WeeklyTopBar } from "./_components/WeeklyTopBar";

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
  const [slotOverlapConfirm, setSlotOverlapConfirm] = useState<PrivateLessonSlotOverlapConfirmState | null>(null);
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
    // Faz 11.5 — Dakika başına debounced tick.
    // `now` çoğunlukla sadece "şu an" çizgisi ve aktif slot vurgusunu etkiler;
    // 30sn yerine 60sn yeterli ve rerender maliyetini yarıya indirir.
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const dayStarts = useMemo(() => getWeekDayStarts(weekStart), [weekStart]);
  const appTz = snapshot?.timeZone ?? SCHEDULE_APP_TIME_ZONE;
  const shownDayStarts = useMemo(
    () => (focusedDayKey ? dayStarts.filter((d) => isoToZonedDateKey(d, appTz) === focusedDayKey) : dayStarts),
    [dayStarts, focusedDayKey, appTz]
  );
  useEffect(() => {
    if (!focusedDayKey) return;
    if (shownDayStarts.length > 0) return;
    const id = window.setTimeout(() => setFocusedDayKey(null), 0);
    return () => window.clearTimeout(id);
  }, [focusedDayKey, shownDayStarts]);
  const itemsByDay = useMemo(() => {
    const map = new Map<string, WeeklyLessonScheduleItem[]>();
    for (const dayIso of dayStarts) map.set(isoToZonedDateKey(dayIso, appTz), []);
    for (const item of snapshot?.items || []) {
      const key = isoToZonedDateKey(item.startsAt, appTz);
      if (!map.has(key)) continue;
      map.get(key)!.push(item);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [dayStarts, snapshot?.items, appTz]);

  const hourRows = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i),
    []
  );

  function shiftWeek(days: number) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + days);
    setWeekStart(getWeekStartMondayIso(start.toISOString()));
  }

  const weekLabel = `${new Date(dayStarts[0]).toLocaleDateString("tr-TR", { timeZone: appTz })} - ${new Date(
    dayStarts[6]
  ).toLocaleDateString("tr-TR", { timeZone: appTz })}`;
  // Faz 12.5 — `nowTop` artık WeeklyNowLine leaf component'inde hesaplanır;
  // burada yalnızca `todayKey` (gün vurgusu) ve `weekContainsToday` için
  // `now` kullanılır. Minute tick'i de sadece bu iki türevde tetikleme yapar.
  const todayKey = isoToZonedDateKey(now.toISOString(), appTz);
  const weekContainsToday = dayStarts.some((d) => isoToZonedDateKey(d, appTz) === todayKey);
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
        timeZone: appTz,
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "";
  const quickCreateTimeLabel = quickCreateAt ? formatLessonTimeTr(quickCreateAt.toISOString(), appTz) : "";
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
        try {
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
            const active = (packageRes.packages || []).filter(
              (p) => p.isActive && p.remainingLessons > 0
            );
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
          if (!cancelled && !("error" in locationsRes)) {
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
        } catch (err) {
          if (!cancelled) {
            setQuickPackages([]);
            setQuickInfo("Özel ders planlama verisi alınamadı. Tekrar deneyin.");
            if (process.env.NODE_ENV !== "production") {
              console.error("[weekly-quick-create load]", err);
            }
          }
        } finally {
          if (!cancelled) setQuickBusy(false);
        }
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
      const slotClock = formatLessonTimeTr(quickCreateAt.toISOString(), appTz);
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
  }, [quickCreateAt, appTz]);

  useEffect(() => {
    if (!recentCreatedRange) return;
    const wait = Math.max(0, recentCreatedRange.expiresAt - Date.now());
    const timer = window.setTimeout(() => setRecentCreatedRange(null), wait);
    return () => window.clearTimeout(timer);
  }, [recentCreatedRange]);

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
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString(), appTz);
    const startClockEff = groupForm.startClock || quickCreateTimeLabel;
    const endClockEff =
      groupForm.endClock ||
      minutesToClock((parseClockToMinutes(groupForm.startClock || startClockEff || "00:00") || 0) + duration);
    const startIso = wallClockInZoneToUtcIso(lessonDate, startClockEff, appTz);
    const endIso = wallClockInZoneToUtcIso(lessonDate, endClockEff, appTz);
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
      dayKey: isoToZonedDateKey(startIso, appTz),
      startMinutes: isoToZonedClockMinutesFromMidnight(startIso, appTz),
      endMinutes: isoToZonedClockMinutesFromMidnight(endIso, appTz),
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
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString(), appTz);
    const slotClock = formatLessonTimeTr(quickCreateAt.toISOString(), appTz);
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
    try {
      const overlapConfirm = await runPrivateLessonCreateWithSlotConfirm(fd, setSlotOverlapConfirm);
      if (!overlapConfirm.proceed) {
        setQuickBusy(false);
        setQuickInfo(null);
        if (overlapConfirm.previewError) setQuickError(overlapConfirm.previewError);
        return;
      }
      const res = await createPrivateLessonSession(fd);
      if ("error" in res) {
        setQuickError(res.error || "Özel ders planlanamadı.");
        setQuickInfo(null);
        return;
      }
      setQuickInfo("Özel ders planlandı, takvim güncelleniyor…");
      await fetchSnapshot();
      setQuickCreateAt(null);
      setQuickInfo(null);
      setActionMessage("Özel ders takvimden planlandı.");
      setRecentCreatedRange({
        dayKey: lessonDate,
        startMinutes: startMin,
        endMinutes: endMin,
        expiresAt: Date.now() + 3500,
      });
    } catch (err) {
      setQuickError("Özel ders planlanamadı. Tekrar deneyin.");
      setQuickInfo(null);
      if (process.env.NODE_ENV !== "production") {
        console.error("[weekly-private-submit]", err);
      }
    } finally {
      setQuickBusy(false);
    }
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
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString(), appTz);
    const startClockEff = groupForm.startClock || quickCreateTimeLabel;
    const endClockEff =
      groupForm.endClock ||
      minutesToClock((parseClockToMinutes(groupForm.startClock || startClockEff || "00:00") || 0) + (Number.isFinite(duration) ? duration : 60));
    const startIso = wallClockInZoneToUtcIso(lessonDate, startClockEff, appTz);
    const endIso = wallClockInZoneToUtcIso(lessonDate, endClockEff, appTz);
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
      dayKey: isoToZonedDateKey(startIso, appTz),
      startMinutes: isoToZonedClockMinutesFromMidnight(startIso, appTz),
      endMinutes: isoToZonedClockMinutesFromMidnight(endIso, appTz),
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
    const lessonDate = isoToZonedDateKey(quickCreateAt.toISOString(), appTz);
    const slotClock = formatLessonTimeTr(quickCreateAt.toISOString(), appTz);
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
    try {
      const overlapConfirm = await runPrivateLessonCreateWithSlotConfirm(fd, setSlotOverlapConfirm);
      if (!overlapConfirm.proceed) {
        setQuickBusy(false);
        setQuickInfo(null);
        if (overlapConfirm.previewError) setQuickError(overlapConfirm.previewError);
        return;
      }
      const res = await createPrivateLessonSession(fd);
      if ("error" in res) {
        setQuickError(res.error || "Hızlı özel ders planlanamadı.");
        setQuickInfo(null);
        return;
      }
      setQuickInfo("Özel ders planlandı, takvim güncelleniyor…");
      await fetchSnapshot();
      setQuickCreateAt(null);
      setQuickInfo(null);
      setActionMessage("Hızlı özel ders planlandı.");
      setRecentCreatedRange({
        dayKey: lessonDate,
        startMinutes: startMin,
        endMinutes: endMin,
        expiresAt: Date.now() + 3500,
      });
    } catch (err) {
      setQuickError("Hızlı özel ders planlanamadı. Tekrar deneyin.");
      setQuickInfo(null);
      if (process.env.NODE_ENV !== "production") {
        console.error("[weekly-oneclick-private]", err);
      }
    } finally {
      setQuickBusy(false);
    }
  }

  // Faz 11.5 — Stable callback referansları; child memo'ları gereksiz
  // rerender'lardan korur.
  const handleQuickCancelAsync = useCallback((item: WeeklyLessonScheduleItem) => {
    void handleQuickCancel(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleQuickHardDeleteAsync = useCallback((item: WeeklyLessonScheduleItem) => {
    void handleQuickHardDelete(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleOpenOverlap = useCallback(
    (title: string, items: WeeklyLessonScheduleItem[]) => {
      setOverlapListItems(items);
      setOverlapListTitle(title);
      setOverlapListOpen(true);
    },
    []
  );

  async function handleMarkCompleted(item: WeeklyLessonScheduleItem) {
    if (item.sourceType !== "private") return;
    setActionBusy(item.id);
    const res = await markPrivateLessonSessionCompletedFromSchedule(item.id);
    if ("error" in res) {
      setActionMessage(res.error || "Ders tamamlanamadı.");
    } else {
      setActionMessage(
        ("message" in res && res.message) ||
          ("alreadyCompleted" in res && res.alreadyCompleted
            ? "Bu ders zaten yapıldı olarak işaretlenmiş."
            : "Ders tamamlandı ve paket hakkı düşüldü.")
      );
      await fetchSnapshot();
      if (selected?.id === item.id) setSelected(null);
    }
    setActionBusy(null);
  }

  const handleMarkCompletedAsync = useCallback((item: WeeklyLessonScheduleItem) => {
    void handleMarkCompleted(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <WeeklyTopBar
        weekStart={weekStart}
        weekLabel={weekLabel}
        lessonType={lessonType}
        coachId={coachId}
        location={location}
        snapshot={snapshot}
        locationOptions={locationOptions}
        selectedLocationColor={selectedLocationColor}
        summary={summary}
        onWeekStartChange={setWeekStart}
        onShiftWeek={shiftWeek}
        onLessonTypeChange={setLessonType}
        onCoachIdChange={setCoachId}
        onLocationChange={setLocation}
      />

      <PrivateLessonParallelMetricsStrip />

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
                Gün detayı · {dayTitle(shownDayStarts[0] || dayStarts[0], appTz)}
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
          <WeeklyScheduleGrid
            shownDayStarts={shownDayStarts}
            focusedDayKey={focusedDayKey}
            todayKey={todayKey}
            weekContainsToday={weekContainsToday}
            hourRows={hourRows}
            itemsByDay={itemsByDay}
            appTz={appTz}
            recentCreatedRange={recentCreatedRange}
            actionBusyId={actionBusy}
            onSelectItem={setSelected}
            onFocusDay={setFocusedDayKey}
            onAnchorQuickCreate={setQuickCreateAt}
            onOpenOverlap={handleOpenOverlap}
            onQuickCancel={handleQuickCancelAsync}
            onQuickHardDelete={handleQuickHardDeleteAsync}
          />

          <WeeklyMobileList
            shownDayStarts={shownDayStarts}
            itemsByDay={itemsByDay}
            appTz={appTz}
            onSelect={setSelected}
          />
        </>
      )}

      {selected ? (
        <LessonDetailModal
          selected={selected}
          appTz={appTz}
          actionBusyId={actionBusy}
          onClose={() => setSelected(null)}
          onCancel={(item) => void handleQuickCancel(item)}
          onHardDelete={(item) => void handleQuickHardDelete(item)}
          onMarkCompleted={handleMarkCompletedAsync}
        />
      ) : null}

      <OverlapListModal
        open={overlapListOpen}
        title={overlapListTitle}
        items={overlapListItems}
        appTz={appTz}
        onClose={() => setOverlapListOpen(false)}
        onSelect={(item) => {
          setSelected(item);
          setOverlapListOpen(false);
        }}
      />

      {slotOverlapConfirm ? (
        <PrivateLessonSlotOverlapConfirmModal
          preview={slotOverlapConfirm.preview}
          appTz={appTz}
          busy={quickBusy}
          onCancel={() => slotOverlapConfirm.resolve(false)}
          onConfirm={() => slotOverlapConfirm.resolve(true)}
        />
      ) : null}

      {quickCreateAt ? (
        <QuickCreateLessonModal
          quickCreateAt={quickCreateAt}
          quickMode={quickMode}
          quickBusy={quickBusy}
          quickError={quickError}
          quickInfo={quickInfo}
          quickCreateDateLabel={quickCreateDateLabel}
          quickCreateTimeLabel={quickCreateTimeLabel}
          quickCoachOptions={quickCoachOptions}
          quickPackages={quickPackages}
          quickHasActivePackage={quickHasActivePackage}
          canQuickPrivateCreate={canQuickPrivateCreate}
          groupForm={groupForm}
          privateForm={privateForm}
          quickGroupTitle={quickGroupTitle}
          locationOptions={locationOptions}
          newLocationName={newLocationName}
          newLocationColor={newLocationColor}
          locationBusy={locationBusy}
          groupTimeValidation={groupTimeValidation}
          privateTimeValidation={privateTimeValidation}
          inlineTimePreview={inlineTimePreview}
          onClose={() => setQuickCreateAt(null)}
          onChangeMode={setQuickMode}
          onChangeQuickGroupTitle={setQuickGroupTitle}
          onChangeGroupForm={setGroupForm}
          onChangePrivateForm={setPrivateForm}
          onChangeNewLocationName={setNewLocationName}
          onChangeNewLocationColor={setNewLocationColor}
          onSyncGroupDurationFromRange={syncDurationFromRange}
          onSyncGroupEndFromDuration={syncEndFromDuration}
          onSyncPrivateDurationFromRange={syncPrivateDurationFromRange}
          onSyncPrivateEndFromDuration={syncPrivateEndFromDuration}
          onSubmitQuickGroup={() => void submitQuickGroupLesson()}
          onSubmitOneClickGroup={() => void submitOneClickGroupLesson()}
          onSubmitQuickPrivate={() => void submitQuickPrivateLesson()}
          onSubmitOneClickPrivate={() => void submitOneClickPrivateLesson()}
          onCreateLocation={() => void handleCreateLocation()}
        />
      ) : null}

      {!loading && !error && emptyState ? (
        <div className="mt-5">
          <EmptyState
            variant={hasOnlyCoachFilter || hasFilterBeyondWeek ? "filtered_empty" : "onboarding"}
            title={emptyState.title}
            description={emptyState.description}
            primaryAction={{ label: "Ders oluştur", href: "/dersler" }}
            secondaryAction={
              hasOnlyCoachFilter || hasFilterBeyondWeek
                ? {
                    label: "Filtreleri temizle",
                    onClick: () => {
                      setLessonType("all");
                      setCoachId("");
                      setLocation("");
                    },
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
