const SESSION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isFieldTestSessionDate(value: string): boolean {
  return SESSION_DATE_PATTERN.test(value.trim());
}

export function hrefFieldTestSession(date: string): string {
  return `/saha-testleri/oturum/${date}`;
}

export function isFieldTestSessionEntryPath(pathname: string): boolean {
  return pathname === "/saha-testleri" || /^\/saha-testleri\/oturum\/\d{4}-\d{2}-\d{2}$/.test(pathname);
}

export function todayFieldTestSessionDate(): string {
  return new Date().toISOString().split("T")[0]!;
}
