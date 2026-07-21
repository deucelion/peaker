/** Bilgilendirme metni — engellemez (legacy; modal tercih edilir). */
export function privateLessonSlotOverlapWarningMessage(existingPeerCount: number): string | null {
  const n = Math.floor(existingPeerCount);
  if (n <= 0) return null;
  const suffix = n === 1 ? "1 özel dersi daha" : `${n} özel dersi daha`;
  return `⚠️ Bu zaman diliminde aynı koçun ${suffix} bulunuyor.\n\nDevam etmek istiyor musunuz?`;
}

export type PrivateLessonSlotOverlapPeer = {
  id: string;
  athleteName: string | null;
  packageName: string | null;
  startsAt: string;
  endsAt: string;
};

export type CoachSlotCapacityLevel = "normal" | "warning" | "critical";

export type PrivateLessonSlotOverlapPreviewResult = {
  overlappingCount: number;
  peers: PrivateLessonSlotOverlapPeer[];
  slotStartsAt: string;
  slotEndsAt: string;
  newAthleteName: string;
  /** Mevcut planlı + yeni kayıt */
  totalAfterCreate: number;
  capacityLevel: CoachSlotCapacityLevel;
};

/** 2 sporcu normal, 3 uyarı, 4+ kritik (engellemez). */
export function resolveCoachSlotCapacityLevel(totalAfterCreate: number): CoachSlotCapacityLevel {
  const n = Math.floor(totalAfterCreate);
  if (n >= 4) return "critical";
  if (n >= 3) return "warning";
  return "normal";
}

export function formatPrivateLessonSlotOverlapIntro(existingPeerCount: number): string {
  const n = Math.max(0, Math.floor(existingPeerCount));
  const suffix = n === 1 ? "1 özel dersi" : `${n} özel dersi`;
  return `Bu koçun aynı zaman aralığında ${suffix} bulunmaktadır.`;
}

export function coachSlotCapacityMessage(level: CoachSlotCapacityLevel, totalAfterCreate: number): string | null {
  if (level === "critical") {
    return `Bu zaman diliminde koçun toplam ${totalAfterCreate} aktif özel dersi olacaktır. Koç kapasitesini kontrol edin.`;
  }
  if (level === "warning") {
    return `Bu zaman diliminde koçun toplam ${totalAfterCreate} aktif özel dersi olacaktır.`;
  }
  return null;
}

export type PrivateLessonParallelMetricsInput = {
  id: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type PrivateLessonParallelPlanningMetrics = {
  monthLabel: string;
  totalPrivateLessons: number;
  parallelPlannedSessions: number;
  busiestHourLabel: string | null;
};

function sessionsOverlap(a: PrivateLessonParallelMetricsInput, b: PrivateLessonParallelMetricsInput): boolean {
  if (a.coachId !== b.coachId) return false;
  const aStart = new Date(a.startsAt).getTime();
  const aEnd = new Date(a.endsAt).getTime();
  const bStart = new Date(b.startsAt).getTime();
  const bEnd = new Date(b.endsAt).getTime();
  return aStart < bEnd && aEnd > bStart;
}

/** Aynı koç + çakışan zaman diliminde en az bir başka oturumu olan kayıtlar. */
export function computeParallelPlannedSessionCount(sessions: PrivateLessonParallelMetricsInput[]): number {
  const active = sessions.filter((s) => (s.status || "").toLowerCase() !== "cancelled");
  let count = 0;
  for (let i = 0; i < active.length; i++) {
    const s = active[i];
    const hasPeer = active.some((other, j) => j !== i && sessionsOverlap(s, other));
    if (hasPeer) count += 1;
  }
  return count;
}

export function computeBusiestStartHourLabel(
  sessions: PrivateLessonParallelMetricsInput[],
  timeZone: string
): string | null {
  if (sessions.length === 0) return null;
  const buckets = new Map<number, number>();
  for (const s of sessions) {
    const hour = Number(
      new Intl.DateTimeFormat("tr-TR", { timeZone, hour: "2-digit", hour12: false }).format(new Date(s.startsAt))
    );
    if (!Number.isFinite(hour)) continue;
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
  }
  let bestHour: number | null = null;
  let bestCount = 0;
  for (const [hour, c] of buckets) {
    if (c > bestCount) {
      bestCount = c;
      bestHour = hour;
    }
  }
  if (bestHour == null) return null;
  return `${String(bestHour).padStart(2, "0")}:00`;
}

export function buildPrivateLessonParallelPlanningMetrics(
  sessions: PrivateLessonParallelMetricsInput[],
  monthLabel: string,
  timeZone: string
): PrivateLessonParallelPlanningMetrics {
  const nonCancelled = sessions.filter((s) => (s.status || "").toLowerCase() !== "cancelled");
  return {
    monthLabel,
    totalPrivateLessons: nonCancelled.length,
    parallelPlannedSessions: computeParallelPlannedSessionCount(nonCancelled),
    busiestHourLabel: computeBusiestStartHourLabel(nonCancelled, timeZone),
  };
}
