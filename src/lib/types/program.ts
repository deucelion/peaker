export interface AthleteProgram {
  id: string;
  organizationId: string;
  coachId: string;
  coachName: string;
  athleteId: string;
  athleteName: string;
  title: string;
  content: string;
  weekStart: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isActive: boolean;
}
