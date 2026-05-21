/**
 * Faz 15 — Audit log tipleri (use server dosyasından ayrıldı).
 * Client ve server action'lar buradan import eder.
 */

import type { AuditAction, AuditEntityType } from "@/lib/audit/types";

export type AuditLogListItem = {
  id: string;
  organizationId: string | null;
  userId: string;
  actorName: string;
  role: string;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AuditLogFilter = {
  organizationId?: string | null;
  action?: string | null;
  entityType?: string | null;
  fromIso?: string | null;
  toIso?: string | null;
  page?: number;
  pageSize?: number;
};

export type AuditLogErrorKind =
  | "permission_denied"
  | "auth_required"
  | "invalid_input"
  | "fetch_error"
  | "timeout";

export type AuditLogListSuccess = {
  items: AuditLogListItem[];
  total: number;
  page: number;
  pageSize: number;
  scope: { role: string; organizationId: string | null };
};

export type AuditLogListResult =
  | AuditLogListSuccess
  | { error: string; errorKind?: AuditLogErrorKind; diagnosticsCode?: string };
