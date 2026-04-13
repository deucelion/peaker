export type UserRole = "admin" | "coach" | "sporcu";

export interface ProfileBasic {
  id: string;
  full_name: string;
  organization_id?: string | null;
  role?: UserRole | string;
  /** false = pasif sporcu/koc; null/undefined migration oncesi → aktif kabul */
  is_active?: boolean | null;
  number?: string | null;
  position?: string | null;
  team?: string | null;
  avatar_url?: string | null;
  height?: number | null;
  weight?: number | null;
}

export interface PaymentRow {
  id: string;
  profile_id: string;
  organization_id: string;
  amount: number;
  payment_type: "aylik" | "paket";
  due_date: string | null;
  payment_date?: string | null;
  status: "bekliyor" | "odendi" | string;
  total_sessions: number | null;
  remaining_sessions: number | null;
  description: string | null;
}

export interface PlayerWithPayments extends ProfileBasic {
  payments?: PaymentRow[];
}

export interface TestDefinitionRow {
  id: string;
  organization_id: string;
  name: string;
  unit: string;
  category?: string | null;
  created_at?: string | null;
}

export interface AthleticResultRow {
  profile_id: string;
  test_id: string;
  value: number;
  test_date: string;
}

export interface TrainingScheduleRow {
  id: string;
  organization_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
}

export interface TrainingParticipantRow {
  id?: string;
  training_id: string;
  profile_id: string;
  is_present: boolean | null;
  attendance_status?: "registered" | "attended" | "missed" | "cancelled" | null;
  marked_by?: string | null;
  marked_at?: string | null;
  profiles: ProfileBasic;
}
