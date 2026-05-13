import { isoToZonedClockMinutesFromMidnight, zonedNowClockMinutes } from "@/lib/schedule/scheduleWallTime";
import { SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";
import type { WeeklyLessonScheduleItem } from "@/lib/types";

/**
 * Faz 6.1 — Haftalık ders programı saf yardımcıları.
 *
 * page.tsx içinde 200+ satır helper vardı; davranış birebir korunuyor.
 * Constant + util ayrımı sayesinde grid hesaplarını test etmek de kolaylaşır.
 */

export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 23;
export const DAY_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
export const GRID_CONTAINER_HEIGHT_REM = (GRID_END_HOUR - GRID_START_HOUR + 1) * 4;

/** Hafta başı (Pzt 00:00 UTC) seçicisi — hafta sınırı mevcut UTC-temelli yardımcılarla uyumlu kalsın. */
export function utcDateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayTitle(iso: string, tz: string = SCHEDULE_APP_TIME_ZONE) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function lessonStatusLabelTr(status: string) {
  const s = status.toLowerCase();
  if (s === "scheduled" || s === "planned") return "Planlandı";
  if (s === "cancelled") return "İptal Edildi";
  if (s === "completed") return "Tamamlandı";
  return "Planlandı";
}

export function itemTopAndHeight(item: WeeklyLessonScheduleItem, tz: string = SCHEDULE_APP_TIME_ZONE) {
  const startMinutes = isoToZonedClockMinutesFromMidnight(item.startsAt, tz);
  const endMinutes = isoToZonedClockMinutesFromMidnight(item.endsAt, tz);
  const clampStart = Math.max(startMinutes, GRID_START_HOUR * 60);
  const clampEnd = Math.min(Math.max(endMinutes, clampStart + 20), GRID_END_HOUR * 60);
  const top = ((clampStart - GRID_START_HOUR * 60) / DAY_MINUTES) * 100;
  const height = Math.max(((clampEnd - clampStart) / DAY_MINUTES) * 100, 3.2);
  return { top, height };
}

export type DayLayoutItem = {
  item: WeeklyLessonScheduleItem;
  laneIndex: number;
  laneCount: number;
  groupId: string;
  groupSize: number;
};

export function computeDayOverlapLayout(items: WeeklyLessonScheduleItem[]): DayLayoutItem[] {
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

export function nowLineTopPercent(now: Date, tz: string = SCHEDULE_APP_TIME_ZONE) {
  const { minutesFromDayStart } = zonedNowClockMinutes(now, tz);
  if (minutesFromDayStart < GRID_START_HOUR * 60 || minutesFromDayStart > GRID_END_HOUR * 60) return null;
  return ((minutesFromDayStart - GRID_START_HOUR * 60) / DAY_MINUTES) * 100;
}

export function parseClockToMinutes(clock: string) {
  const [hRaw, mRaw] = clock.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function minutesToClock(total: number) {
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

export function locationCardStyle(locationColor: string | null): React.CSSProperties | undefined {
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
