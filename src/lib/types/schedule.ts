import type { CoachPermissions } from "@/lib/types/permission";

export type WeeklyLessonSourceType = "group" | "private";
export type WeeklyLessonTypeFilter = "all" | "group" | "private";

export interface WeeklyLessonScheduleCoachOption {
  id: string;
  full_name: string;
}

export interface WeeklyLessonScheduleItem {
  id: string;
  sourceType: WeeklyLessonSourceType;
  title: string;
  subtitle: string | null;
  coachId: string | null;
  coachName: string | null;
  participantCount: number;
  participantNames: string[];
  startsAt: string;
  endsAt: string;
  location: string | null;
  locationColor: string | null;
  note: string | null;
  detailHref: string;
  status: string;
}

export interface WeeklyLessonScheduleSnapshot {
  role: "admin" | "coach";
  permissions: CoachPermissions;
  weekStartIso: string;
  weekEndIso: string;
  selectedCoachId: string | null;
  coachOptions: WeeklyLessonScheduleCoachOption[];
  items: WeeklyLessonScheduleItem[];
}
