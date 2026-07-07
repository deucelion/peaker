const STORAGE_KEY = "peaker.performans.preferences";

export type PerformanceUiPreferences = {
  selectedAthleteId?: string;
  appliedPreset?: "7" | "14" | "28" | "90";
  viewMode?: "chart" | "team";
};

function readRaw(): PerformanceUiPreferences {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PerformanceUiPreferences;
  } catch {
    return {};
  }
}

function writeRaw(next: PerformanceUiPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadPerformancePreferences(): PerformanceUiPreferences {
  return readRaw();
}

export function savePerformancePreferences(patch: Partial<PerformanceUiPreferences>): void {
  writeRaw({ ...readRaw(), ...patch });
}

export function clearPerformancePreferences(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
