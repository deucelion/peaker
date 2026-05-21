import type { SchemaCapabilities } from "@/lib/schemaCompat/capabilities";

const PLP_CORE =
  "id, package_id, athlete_id, coach_id, amount, paid_at, note, created_by, created_at, organization_id";

/** Aktif (iptal edilmemiş) PLP satırları için filtre uygular. */
export function applyPrivateLessonPaymentActiveFilter<Q extends { is: (col: string, val: null) => Q }>(
  query: Q,
  caps: SchemaCapabilities
): Q {
  if (caps.payments.privateLessonVoidedAt) {
    return query.is("voided_at", null);
  }
  return query;
}

export function buildPrivateLessonPaymentSelect(caps: SchemaCapabilities): string {
  void caps;
  return PLP_CORE;
}

export function ledgerVoidUnavailableMessage(caps: SchemaCapabilities): string | null {
  if (!caps.payments.privateLessonVoidedAt) {
    return "Paket tahsilat iptali için FAZ 19 veritabanı güncellemesi gerekli (voided_at).";
  }
  if (!caps.payments.privateLessonVoidRpc) {
    return "Paket tahsilat iptali için FAZ 19 RPC migration uygulanmalı.";
  }
  return null;
}
