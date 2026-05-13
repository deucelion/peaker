"use client";

import { useCallback, useMemo, useState } from "react";
import type { QueryErrorKind } from "@/lib/ui/queryState";
import { istanbulLastNDaysInclusive } from "@/lib/performance/performanceDateRange";

/**
 * Faz 8.5 — Performance dashboard date-range orchestration foundation.
 *
 * Bu hook performans sayfasının "draft vs applied range" pattern'ini, preset
 * yönetimini ve filter validation'ını sarmalar. Davranış parity korunur.
 *
 * Notlar:
 *   - performans/page.tsx kademeli olarak bu hook'a geçebilir.
 *   - Tam fetch lifecycle (athlete listesi, loads, wellness) henüz dahil edilmedi;
 *     bu Faz 9'da tek seferde değil parçalı taşınabilir.
 */

export type PerformanceRangeMode = "preset" | "custom";
export type PerformancePresetKey = "7" | "14" | "28" | "90";

export type PerformanceRangeState = {
  rangeMode: PerformanceRangeMode;
  draftPreset: PerformancePresetKey;
  draftFrom: string;
  draftTo: string;
  appliedFrom: string;
  appliedTo: string;
  appliedPreset: PerformancePresetKey | null;
};

export type PerformanceDashboardState = {
  range: PerformanceRangeState;
  filterError: string | null;
  loading: boolean;
  loadError: string | null;
  loadErrorKind: QueryErrorKind | null;
  /** Faz 10.1a — seçili sporcu. Empty string = sporcu seçilmemiş. */
  selectedAthleteId: string;
};

export type UsePerformanceDashboardReturn = PerformanceDashboardState & {
  setRangeMode: (mode: PerformanceRangeMode) => void;
  setDraftPreset: (preset: PerformancePresetKey) => void;
  setDraftFrom: (value: string) => void;
  setDraftTo: (value: string) => void;
  applyFilters: () => boolean;
  resetToDefault: (timeZone?: string) => void;
  setLoading: (value: boolean) => void;
  setLoadError: (value: string | null) => void;
  setLoadErrorKind: (value: QueryErrorKind | null) => void;
  setSelectedAthleteId: (value: string) => void;
};

export function usePerformanceDashboard(options?: {
  timeZone?: string;
  initialPreset?: PerformancePresetKey;
}): UsePerformanceDashboardReturn {
  const initialPreset: PerformancePresetKey = options?.initialPreset ?? "28";
  const tz = options?.timeZone ?? "Europe/Istanbul";
  const initialRange = useMemo(() => {
    const n = presetToDays(initialPreset);
    return istanbulLastNDaysInclusive(n, tz);
  }, [initialPreset, tz]);

  const [rangeMode, setRangeMode] = useState<PerformanceRangeMode>("preset");
  const [draftPreset, setDraftPreset] = useState<PerformancePresetKey>(initialPreset);
  const [draftFrom, setDraftFrom] = useState<string>(initialRange.from);
  const [draftTo, setDraftTo] = useState<string>(initialRange.to);
  const [appliedFrom, setAppliedFrom] = useState<string>(initialRange.from);
  const [appliedTo, setAppliedTo] = useState<string>(initialRange.to);
  const [appliedPreset, setAppliedPreset] = useState<PerformancePresetKey | null>(initialPreset);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorKind, setLoadErrorKind] = useState<QueryErrorKind | null>(null);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>("");

  const applyFilters = useCallback((): boolean => {
    setFilterError(null);
    if (rangeMode === "custom") {
      if (!draftFrom || !draftTo) {
        setFilterError("Baslangic ve bitis tarihlerini secin.");
        return false;
      }
      if (draftFrom > draftTo) {
        setFilterError("Baslangic, bitisten sonra olamaz.");
        return false;
      }
      setAppliedFrom(draftFrom);
      setAppliedTo(draftTo);
      setAppliedPreset(null);
      return true;
    }
    const n = presetToDays(draftPreset);
    const { from, to } = istanbulLastNDaysInclusive(n, tz);
    setAppliedFrom(from);
    setAppliedTo(to);
    setDraftFrom(from);
    setDraftTo(to);
    setAppliedPreset(draftPreset);
    return true;
  }, [rangeMode, draftFrom, draftTo, draftPreset, tz]);

  const resetToDefault = useCallback(
    (zone?: string) => {
      const z = zone ?? tz;
      const { from, to } = istanbulLastNDaysInclusive(presetToDays(initialPreset), z);
      setRangeMode("preset");
      setDraftPreset(initialPreset);
      setDraftFrom(from);
      setDraftTo(to);
      setAppliedFrom(from);
      setAppliedTo(to);
      setAppliedPreset(initialPreset);
      setFilterError(null);
    },
    [tz, initialPreset]
  );

  return {
    range: {
      rangeMode,
      draftPreset,
      draftFrom,
      draftTo,
      appliedFrom,
      appliedTo,
      appliedPreset,
    },
    filterError,
    loading,
    loadError,
    loadErrorKind,
    selectedAthleteId,
    setRangeMode,
    setDraftPreset,
    setDraftFrom,
    setDraftTo,
    applyFilters,
    resetToDefault,
    setLoading,
    setLoadError,
    setLoadErrorKind,
    setSelectedAthleteId,
  };
}

function presetToDays(preset: PerformancePresetKey): number {
  return preset === "7" ? 7 : preset === "14" ? 14 : preset === "90" ? 90 : 28;
}
