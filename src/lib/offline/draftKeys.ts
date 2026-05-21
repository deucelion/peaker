/** FAZ 25 — tenant/user scoped form draft keys (string). */

export function attendanceDraftKey(lessonId: string, userId: string): string {
  return `attendance:${lessonId}:${userId}`;
}

export function fieldTestDraftKey(athleteScope: string, testDate: string, userId: string): string {
  return `field-test:${athleteScope}:${testDate}:${userId}`;
}

export function coachNoteDraftKey(athleteId: string, coachId: string): string {
  return `coach-note:${athleteId}:${coachId}`;
}

export function attendanceIdempotencyKey(trainingId: string, profileId: string, status: string): string {
  return `attendance:${trainingId}:${profileId}:${status}`;
}

export function coachNoteIdempotencyKey(draftId: string): string {
  return `coach-note:${draftId}`;
}

export function fieldTestIdempotencyKey(testDate: string, draftId: string): string {
  return `field-test:${testDate}:${draftId}`;
}
