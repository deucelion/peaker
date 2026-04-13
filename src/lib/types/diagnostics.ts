export interface SystemHealthCheckResult {
  key: string;
  title: string;
  passed: boolean;
  details: string;
  migration: string;
}

export interface SystemHealthReport {
  generatedAt: string;
  overallPassed: boolean;
  checks: SystemHealthCheckResult[];
}
