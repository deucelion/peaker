import type { CoachLesson, CoachProfile } from "@/lib/types/coach";
import { toDisplayName } from "@/lib/profile/displayName";

type RawCoach = {
  id?: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  specialization?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  organization_id?: string | null;
};

type RawSchedule = {
  id?: string;
  title?: string | null;
  start_time?: string | null;
  location?: string | null;
};

export function mapCoach(raw: RawCoach): CoachProfile {
  return {
    id: raw.id || "",
    fullName: toDisplayName(raw.full_name, raw.email, "Isimsiz Koc"),
    email: raw.email || "-",
    phone: raw.phone || "-",
    expertise: raw.specialization || "Genel",
    isActive: raw.is_active ?? true,
    createdAt: raw.created_at ?? null,
    organizationId: raw.organization_id || "",
  };
}

export function mapCoachLesson(raw: RawSchedule, now = new Date()): CoachLesson {
  const startTime = raw.start_time || new Date(0).toISOString();
  const date = new Date(startTime);
  return {
    id: raw.id || "",
    title: raw.title || "Antrenman",
    startTime,
    location: raw.location || "Ana Saha",
    status: date.getTime() < now.getTime() ? "past" : "upcoming",
  };
}
