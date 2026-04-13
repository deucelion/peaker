/** Hesap aktif/pasif — `profiles.is_active` ile uyumlu. */
export type CoachAccountLifecycleLabel = "active" | "inactive";

export interface CoachProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  expertise: string;
  isActive: boolean;
  createdAt: string | null;
  organizationId: string;
}

export interface CoachLesson {
  id: string;
  title: string;
  startTime: string;
  location: string;
  status: "past" | "upcoming";
}
