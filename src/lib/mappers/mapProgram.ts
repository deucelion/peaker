import type { AthleteProgram } from "@/lib/types";

export type RawProgram = {
  id?: string;
  organization_id?: string;
  coach_id?: string;
  athlete_id?: string;
  content?: string | null;
  title?: string | null;
  note?: string | null;
  week_start?: string | null;
  pdf_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  is_read?: boolean | null;
  is_active?: boolean | null;
  coach_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  athlete_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

function resolveName(
  value: { full_name?: string | null } | { full_name?: string | null }[] | null | undefined,
  fallback: string
) {
  if (!value) return fallback;
  if (Array.isArray(value)) return value[0]?.full_name || fallback;
  return value.full_name || fallback;
}

export function mapAthleteProgram(raw: RawProgram): AthleteProgram {
  return {
    id: raw.id || "",
    organizationId: raw.organization_id || "",
    coachId: raw.coach_id || "",
    coachName: resolveName(raw.coach_profile, "Koc"),
    athleteId: raw.athlete_id || "",
    athleteName: resolveName(raw.athlete_profile, "Sporcu"),
    title: raw.title || "Haftalik Program",
    content: raw.content || raw.note || "",
    weekStart: raw.week_start || null,
    pdfUrl: raw.pdf_url || null,
    createdAt: raw.created_at || new Date(0).toISOString(),
    updatedAt: raw.updated_at || raw.created_at || new Date(0).toISOString(),
    isRead: Boolean(raw.is_read),
    isActive: raw.is_active ?? true,
  };
}
