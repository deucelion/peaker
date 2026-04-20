const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getWeekStartMondayIso(input?: string): string {
  const base = input ? new Date(input) : new Date();
  const safe = Number.isNaN(base.getTime()) ? new Date() : base;
  const dateOnly = toUtcDateOnly(safe);
  const day = dateOnly.getUTCDay() || 7; // Sun => 7
  dateOnly.setUTCDate(dateOnly.getUTCDate() - (day - 1));
  return dateOnly.toISOString();
}

export function getWeekEndExclusiveIso(weekStartIso: string): string {
  const start = new Date(weekStartIso);
  return new Date(start.getTime() + 7 * DAY_MS).toISOString();
}

export function getWeekDayStarts(weekStartIso: string): string[] {
  const start = new Date(weekStartIso);
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * DAY_MS).toISOString());
}

export function sameDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
