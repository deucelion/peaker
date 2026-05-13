/**
 * Faz 8.2 — Job status helpers.
 *
 * Hedef:
 *   - `JobStatus` → kullanıcıya gösterilecek metin / ton eşlemesi.
 *   - Mevcut `queryState` ile uyumlu (amber/red/gray/purple/emerald).
 */

import type { JobStatus } from "./jobTypes";
import type { QueryToneKey } from "@/lib/ui/queryState";

export function jobStatusLabel(status: JobStatus): string {
  switch (status) {
    case "queued":
      return "Sırada";
    case "running":
      return "Çalışıyor";
    case "succeeded":
      return "Tamamlandı";
    case "truncated":
      return "Kısmen tamamlandı";
    case "failed":
      return "Başarısız";
    default:
      return status;
  }
}

export function jobStatusTone(status: JobStatus): QueryToneKey {
  switch (status) {
    case "queued":
    case "running":
      return "purple";
    case "succeeded":
      return "emerald";
    case "truncated":
      return "amber";
    case "failed":
      return "red";
    default:
      return "gray";
  }
}
