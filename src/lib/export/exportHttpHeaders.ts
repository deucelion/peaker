/**
 * Faz 16 — Streaming/sync CSV HTTP response metadata parity.
 */
export function buildCsvDownloadHeaders(
  filename: string,
  meta?: {
    rowCount?: number | null;
    truncated?: boolean;
    cap?: number;
    extra?: Record<string, string>;
  }
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    "Cache-Control": "no-store, max-age=0",
    "X-Accel-Buffering": "no",
    ...meta?.extra,
  };
  if (meta?.rowCount != null && Number.isFinite(meta.rowCount)) {
    headers["X-Peaker-Row-Count"] = String(meta.rowCount);
  }
  if (meta?.cap != null) {
    headers["X-Peaker-Cap"] = String(meta.cap);
  }
  if (meta?.truncated != null) {
    headers["X-Peaker-Truncated"] = meta.truncated ? "1" : "0";
  }
  return headers;
}
