/** Tenant + kullanıcı scope; kuyruk başka hesaba taşınmaz. */
export function buildOfflineScopeKey(organizationId: string | null | undefined, userId: string | null | undefined): string {
  const org = organizationId?.trim() || "no-org";
  const user = userId?.trim() || "anon";
  return `${org}:${user}`;
}

export function filterQueueForScope<T extends { scopeKey: string }>(items: T[], scopeKey: string): T[] {
  return items.filter((item) => item.scopeKey === scopeKey);
}
