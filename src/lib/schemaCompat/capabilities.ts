export type SchemaCapabilities = {
  packages: {
    lifecycleStatus: boolean;
    installmentFields: boolean;
    packageEventsTable: boolean;
  };
  payments: {
    privateLessonVoidedAt: boolean;
    privateLessonVoidRpc: boolean;
  };
  /** Human-readable drift hints for ops UI */
  driftWarnings: string[];
  detectedAt: string;
};

export const DEFAULT_SCHEMA_CAPABILITIES: SchemaCapabilities = {
  packages: {
    lifecycleStatus: false,
    installmentFields: false,
    packageEventsTable: false,
  },
  payments: {
    privateLessonVoidedAt: false,
    privateLessonVoidRpc: false,
  },
  driftWarnings: [
    "Şema algılanamadı; güvenli varsayılan (FAZ 18/19 migration uygulanmamış olabilir).",
  ],
  detectedAt: new Date(0).toISOString(),
};

export function buildDriftWarnings(caps: Omit<SchemaCapabilities, "driftWarnings" | "detectedAt">): string[] {
  const w: string[] = [];
  if (!caps.packages.lifecycleStatus) {
    w.push("private_lesson_packages.lifecycle_status eksik — FAZ 18 migration uygulanmalı.");
  }
  if (!caps.packages.installmentFields) {
    w.push("Paket taksit alanları eksik — FAZ 18 migration.");
  }
  if (!caps.packages.packageEventsTable) {
    w.push("private_lesson_package_events tablosu yok — FAZ 18 migration.");
  }
  if (!caps.payments.privateLessonVoidedAt) {
    w.push("private_lesson_payments.voided_at eksik — FAZ 19 migration.");
  }
  if (!caps.payments.privateLessonVoidRpc) {
    w.push("private_lesson_void_ledger_payment_atomic RPC eksik — FAZ 19 migration.");
  }
  return w;
}

export function compatibilityModeActive(caps: SchemaCapabilities): boolean {
  return caps.driftWarnings.length > 0;
}
