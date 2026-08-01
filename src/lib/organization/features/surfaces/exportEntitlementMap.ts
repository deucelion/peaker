import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/** Export endpoint / action kimligi → entitlement. */
export const EXPORT_ENDPOINT_IDS = {
  paymentsStream: "export:/api/exports/payments/stream",
  receivablesStream: "export:/api/exports/receivables/stream",
  auditLogStream: "export:/api/exports/audit-log/stream",
  auditLogsCsv: "export:audit.exportAuditLogsCSV",
  accountingFinancePaymentsCsv: "export:accountingFinance.exportAccountingFinancePaymentsCSV",
  performanceSummaryCsv: "export:performance.exportPerformanceSummaryCSV",
  fieldTestResultsCsv: "export:fieldTest.exportFieldTestResultsCSV",
} as const;

export type ExportEntitlementMapKey = (typeof EXPORT_ENDPOINT_IDS)[keyof typeof EXPORT_ENDPOINT_IDS];

export const EXPORT_ENTITLEMENT_MAP = {
  [EXPORT_ENDPOINT_IDS.paymentsStream]: ENTITLEMENT_KEYS.finance,
  [EXPORT_ENDPOINT_IDS.receivablesStream]: ENTITLEMENT_KEYS.finance,
  [EXPORT_ENDPOINT_IDS.auditLogStream]: ENTITLEMENT_KEYS.audit,
  [EXPORT_ENDPOINT_IDS.auditLogsCsv]: ENTITLEMENT_KEYS.audit,
  [EXPORT_ENDPOINT_IDS.accountingFinancePaymentsCsv]: ENTITLEMENT_KEYS.finance,
  [EXPORT_ENDPOINT_IDS.performanceSummaryCsv]: ENTITLEMENT_KEYS.insightPerformance,
  [EXPORT_ENDPOINT_IDS.fieldTestResultsCsv]: ENTITLEMENT_KEYS.insightFieldTests,
} as const satisfies Record<ExportEntitlementMapKey, EntitlementKey>;
