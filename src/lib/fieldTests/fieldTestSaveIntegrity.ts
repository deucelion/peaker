import type { FieldTestCellWriteSource } from "@/lib/fieldTests/fieldTestCellWriteGuard";

/**
 * Saha testi kaydinda hicbir hucre/not DB'ye yazilmadan success donulmesini engeller.
 */
export function shouldFailFieldTestSaveWithNoAppliedWrites(
  appliedWrites: number,
  cellCount: number,
  noteCount: number
): boolean {
  return appliedWrites === 0 && (cellCount > 0 || noteCount > 0);
}

/**
 * Online kayitta stale edit_seq ile atlanan hucre varken tam basari donulmesini engeller.
 * Offline replay'de kismi stale beklenen bir durumdur (DB'de daha guncel kayit zaten vardir).
 */
export function shouldFailFieldTestSaveWithStaleSkipsOnline(
  skippedStaleCells: number,
  writeSource: FieldTestCellWriteSource
): boolean {
  return writeSource === "online" && skippedStaleCells > 0;
}
