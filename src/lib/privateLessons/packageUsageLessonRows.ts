import type { PrivateLessonPackageUsageLessonRow } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";

type UsageRow = {
  id: string;
  used_at: string;
  note: string | null;
  athlete_id?: string;
  coach_id?: string | null;
};

type SessionRow = {
  id: string;
  starts_at: string;
  completed_at?: string | null;
  status: string;
  location?: string | null;
  note?: string | null;
  athlete_id?: string;
  coach_id?: string | null;
  athlete_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  coach_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
};

type ParticipantRow = {
  session_id?: string;
  lesson_id?: string;
  attendance_status?: string | null;
  profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
};

export function buildPackageUsageLessonRows(input: {
  packageAthleteName: string;
  usageRows: UsageRow[];
  completedSessions: SessionRow[];
  participantsBySessionId?: Map<string, ParticipantRow[]>;
}): PrivateLessonPackageUsageLessonRow[] {
  const out: PrivateLessonPackageUsageLessonRow[] = [];

  for (const s of input.completedSessions) {
    const athleteRaw = Array.isArray(s.athlete_profile) ? s.athlete_profile[0] : s.athlete_profile;
    const coachRaw = Array.isArray(s.coach_profile) ? s.coach_profile[0] : s.coach_profile;
    const participants = input.participantsBySessionId?.get(s.id) ?? [];
    const attendance =
      participants.find((p) => p.attendance_status)?.attendance_status ??
      (s.status === "completed" ? "completed" : null);

    out.push({
      id: `session-${s.id}`,
      usedAt: s.completed_at || s.starts_at,
      athleteName: toDisplayName(athleteRaw?.full_name, athleteRaw?.email, input.packageAthleteName),
      coachName: coachRaw ? toDisplayName(coachRaw.full_name, coachRaw.email, "Koç") : null,
      lessonTitle: s.location?.trim() || s.note?.trim() || "Özel ders oturumu",
      creditsUsed: 1,
      attendanceStatus: attendance,
      source: "session",
    });
  }

  for (const u of input.usageRows) {
    out.push({
      id: `usage-${u.id}`,
      usedAt: u.used_at,
      athleteName: input.packageAthleteName,
      coachName: null,
      lessonTitle: u.note?.trim() || "Manuel kullanım kaydı",
      creditsUsed: 1,
      attendanceStatus: null,
      source: "usage",
    });
  }

  return out.sort((a, b) => Date.parse(b.usedAt) - Date.parse(a.usedAt));
}
