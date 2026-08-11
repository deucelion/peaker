import type { FieldTestSaveFeedback } from "@/lib/fieldTests/fieldTestAutosave";

/**
 * Saha testi yerel taslağı (localStorage/IndexedDB) yalnızca *senkronlanmamış*
 * kullanıcı girdisi için vardır.
 *
 * Taslak, DB'den hydrate edilmiş değerler için de yazılırsa şu üretim hatası
 * oluşur: hydrate → taslak yazılır → sonraki açılışta taslak DB'nin üzerine
 * geri yüklenir, tüm hücreler `dirty` işaretlenir ve `dirty` durumunda hydrate
 * bloklandığı için form kalıcı olarak eski/boş değerlerde kilitlenir.
 */
export const FIELD_TEST_DRAFT_UNSYNCED_MARKER = "hasUnsyncedWork";

export function fieldTestDraftHasContent(
  values: Record<string, string | number> | undefined | null,
  notes: Record<string, string> | undefined | null
): boolean {
  for (const value of Object.values(values ?? {})) {
    if (String(value ?? "").trim() !== "") return true;
  }
  for (const note of Object.values(notes ?? {})) {
    if (String(note ?? "").trim() !== "") return true;
  }
  return false;
}

/** Taslak yalnızca kaydedilmemiş yerel iş varken diske yazılır. */
export function shouldPersistFieldTestDraft(params: {
  saveFeedback: FieldTestSaveFeedback;
  hasPendingSave: boolean;
}): boolean {
  if (params.hasPendingSave) return true;
  return (
    params.saveFeedback === "dirty" ||
    params.saveFeedback === "queued" ||
    params.saveFeedback === "error"
  );
}

/**
 * Taslak yalnızca şu üç koşulda geri yüklenir:
 *  - aynı oturum tarihine ait,
 *  - senkronlanmamış iş işaretini taşıyor (eski sürümlerin hydrate kopyaları elenir),
 *  - gerçekten içerik barındırıyor (boş taslak kayıtlı ölçümleri silmemeli).
 */
export function shouldRestoreFieldTestDraft(params: {
  payload: Record<string, unknown> | null | undefined;
  sessionDate: string;
}): boolean {
  const payload = params.payload;
  if (!payload) return false;
  if (String(payload.testDate ?? "") !== params.sessionDate) return false;
  if (payload[FIELD_TEST_DRAFT_UNSYNCED_MARKER] !== true) return false;
  return fieldTestDraftHasContent(
    payload.testValues as Record<string, string | number> | undefined,
    payload.generalNotes as Record<string, string> | undefined
  );
}
