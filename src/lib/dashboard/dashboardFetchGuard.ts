/** Ignore stale async dashboard bootstrap results when a newer fetch started. */
export function isStaleDashboardFetchRun(runId: number, latestRunId: number): boolean {
  return runId !== latestRunId;
}
