import type { OrganizationStatus } from "@/lib/organization/lifecycle";
import type { SuperAdminLicenseSignal } from "@/lib/organization/license";

export interface SuperAdminOrgRow {
  id: string;
  name: string | null;
  created_at?: string | null;
  status?: OrganizationStatus | string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  updated_at?: string | null;
}

export interface SuperAdminOrganizationSummary {
  organizationId: string;
  name: string;
  createdAt: string | null;
  status: OrganizationStatus;
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string | null;
  /** Lisans penceresi + statüye göre hesaplanan uyarı (mock değil). */
  licenseSignal: SuperAdminLicenseSignal;
  athletes: number;
  coaches: number;
  totalLessons: number;
  todayLessons: number;
  attendanceMarkedToday: number;
  lastActivityAt: string | null;
  health: "healthy" | "warning";
}

export interface SuperAdminKpis {
  totalOrganizations: number;
  totalAthletes: number;
  totalCoaches: number;
  totalLessons: number;
  activeOrganizations30d: number;
  todayLessons: number;
  criticalWarnings: number;
}
