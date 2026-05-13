"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { ProfileBasic } from "@/types/domain";
import type { TrainingLoadRow, WellnessReportRow } from "@/types/performance";
import type { AthleteInjuryNoteRecord } from "@/lib/types";

/**
 * Faz 8.7 — Athlete detail panel data orchestration foundation.
 *
 * Hedef:
 *   - `sporcu/[id]/page.tsx` içindeki çok parçalı state'i ortak yapıya almak.
 *   - parallel fetch lifecycle ve refresh orchestration için zemin.
 *   - Faz 9'da tam migration; bu turda sadece foundation.
 *
 * Notlar:
 *   - Page tüm state'i tek seferde aktarmıyor; bu yapı küçük parçalarla
 *     adım adım benimsenebilir.
 *   - Behavior parity korunmuştur (tüm setter'lar mevcut state ile birebir).
 */

export type AthletePanelLoadState = {
  loading: boolean;
  error: string | null;
};

export type AthletePanelData = {
  player: ProfileBasic | null;
  wellnessReports: WellnessReportRow[];
  trainingLoads: TrainingLoadRow[];
  injuryNotes: AthleteInjuryNoteRecord[];
};

export type UseAthletePanelReturn = AthletePanelLoadState & {
  data: AthletePanelData;
  setPlayer: Dispatch<SetStateAction<ProfileBasic | null>>;
  setWellnessReports: Dispatch<SetStateAction<WellnessReportRow[]>>;
  setTrainingLoads: Dispatch<SetStateAction<TrainingLoadRow[]>>;
  setInjuryNotes: Dispatch<SetStateAction<AthleteInjuryNoteRecord[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  beginRefresh: () => void;
  endRefresh: () => void;
};

export function useAthletePanel(): UseAthletePanelReturn {
  const [player, setPlayer] = useState<ProfileBasic | null>(null);
  const [wellnessReports, setWellnessReports] = useState<WellnessReportRow[]>([]);
  const [trainingLoads, setTrainingLoads] = useState<TrainingLoadRow[]>([]);
  const [injuryNotes, setInjuryNotes] = useState<AthleteInjuryNoteRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const beginRefresh = useCallback(() => {
    setLoading(true);
    setError(null);
  }, []);

  const endRefresh = useCallback(() => {
    setLoading(false);
  }, []);

  return {
    data: { player, wellnessReports, trainingLoads, injuryNotes },
    loading,
    error,
    setPlayer,
    setWellnessReports,
    setTrainingLoads,
    setInjuryNotes,
    setLoading,
    setError,
    beginRefresh,
    endRefresh,
  };
}
