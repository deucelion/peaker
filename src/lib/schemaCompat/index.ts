export {
  type SchemaCapabilities,
  DEFAULT_SCHEMA_CAPABILITIES,
  buildDriftWarnings,
  compatibilityModeActive,
} from "@/lib/schemaCompat/capabilities";
export { getSchemaCapabilities } from "@/lib/schemaCompat/detect";
export {
  isMissingColumnError,
  isSchemaCompatibilityError,
} from "@/lib/schemaCompat/errors";
export {
  buildPrivateLessonPackageSelect,
  buildPrivateLessonPackageSelectLegacy,
  buildPackageLifecycleProbeSelect,
  buildPackagePaymentGuardSelect,
  buildReceivablePackageSelect,
  mapPackageRowCompat,
  packageCompletedUpdatePayload,
  packageLifecycleUpdatePayload,
  runPackageSelectWithCompat,
  runPackageLifecycleProbeWithCompat,
  runPackagePaymentGuardWithCompat,
  runReceivablePackageSelectWithCompat,
  type RawPackageRow,
} from "@/lib/schemaCompat/packageSelect";
export {
  applyPrivateLessonPaymentActiveFilter,
  buildPrivateLessonPaymentSelect,
  ledgerVoidUnavailableMessage,
} from "@/lib/schemaCompat/paymentSelect";
export { reportSchemaCompatFallback, reportMigrationDriftDetected } from "@/lib/schemaCompat/telemetry";
export { auditListUserMessage, userFacingDataError } from "@/lib/schemaCompat/userMessages";
