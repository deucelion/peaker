import type { AppNotification, Lesson, LessonStatus } from "@/lib/types/lesson";

type RawLesson = {
  id?: string;
  organization_id?: string | null;
  coach_id?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  capacity?: number | null;
  status?: string | null;
  created_by?: string | null;
  created_at?: string | null;
};

type RawNotification = {
  id?: string;
  user_id?: string;
  message?: string | null;
  read?: boolean | null;
  created_at?: string | null;
};

function getSafeLessonStatus(status: string | null | undefined): LessonStatus {
  if (status === "completed" || status === "cancelled") return status;
  return "scheduled";
}

export function mapLesson(raw: RawLesson): Lesson {
  return {
    id: raw.id || "",
    orgId: raw.organization_id || "",
    coachId: raw.coach_id || null,
    title: raw.title || "Ders",
    description: raw.description || "",
    location: raw.location || "Ana Saha",
    startTime: raw.start_time || new Date(0).toISOString(),
    endTime: raw.end_time || raw.start_time || new Date(0).toISOString(),
    capacity: raw.capacity && raw.capacity > 0 ? raw.capacity : 20,
    status: getSafeLessonStatus(raw.status),
    createdBy: raw.created_by || null,
    createdAt: raw.created_at || null,
  };
}

export function mapNotification(raw: RawNotification): AppNotification {
  return {
    id: raw.id || "",
    userId: raw.user_id || "",
    message: raw.message || "",
    read: Boolean(raw.read),
    createdAt: raw.created_at || new Date(0).toISOString(),
  };
}

export function hasTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();
  return aStart < bEnd && aEnd > bStart;
}
