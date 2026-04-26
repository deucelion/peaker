export type LessonStatus = "scheduled" | "completed" | "cancelled";

export interface Lesson {
  id: string;
  orgId: string;
  coachId: string | null;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime: string;
  capacity: number;
  status: LessonStatus;
  participantCount?: number;
  registeredCount?: number;
  attendedCount?: number;
  missedCount?: number;
  createdBy: string | null;
  createdAt: string | null;
}

export interface LessonParticipant {
  lessonId: string;
  profileId: string;
  isPresent: boolean | null;
  attendanceStatus: "registered" | "attended" | "missed" | "cancelled";
  markedBy: string | null;
  markedAt: string | null;
}

export interface AppNotification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
}
