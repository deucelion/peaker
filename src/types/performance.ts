export interface AthleteOption {
  id: string;
  full_name: string;
}

export interface TrainingLoadRow {
  profile_id: string;
  total_load: number | null;
  rpe_score: number | null;
  measurement_date?: string | null;
}

export interface AcwrPoint {
  date: string;
  akut: number;
  kronik: number;
  ratio: number;
  /** Sıralama ve seri (streak) hesapları için */
  ts: number;
}

export interface EwmaPoint {
  date: string;
  /** İstanbul takvim günü ile aralık süzmek için */
  ts: number;
  acuteEwma: number;
  chronicEwma: number;
  ewmaRatio: number;
}

export interface WellnessProfileRef {
  id?: string;
  full_name?: string;
  organization_id?: string;
  avatar_url?: string | null;
}

export interface WellnessReportRow {
  id: string;
  profile_id: string;
  report_date: string;
  resting_heart_rate: number | null;
  fatigue: number | null;
  sleep_quality: number | null;
  muscle_soreness: number | null;
  stress_level: number | null;
  energy_level: number | null;
  notes?: string | null;
  profiles?: WellnessProfileRef | null;
}
