/**
 * Faz 7.6 — Streaming-compatible CSV abstraction.
 *
 * Hedef:
 *   - Mevcut `buildCsv` davranışını korumak (geriye uyumlu).
 *   - İleride büyük org export'ları için chunked emission'a hazır altyapı.
 *   - Henüz queue / job sistemi eklenmiyor (Faz 8+); sadece interface.
 *
 * Şu anki davranış:
 *   - `CsvSink.collect` → tüm satırları biriktirir, sonunda `toString()` çağırır.
 *   - `CsvSink.write` → her satırı anında stream'e basabilir (gelecekte
 *     ReadableStream / Response body için kullanılır).
 *
 * Memory pressure guard:
 *   - Maximum row hard cap parametreli; export action'lar bunu yorumlar.
 *   - Sink, cap'i aşan call'ları sessizce dropping yerine `truncated=true`
 *     bayrağıyla bildirir.
 */

import { buildCsv } from "./csv";

export type CsvSinkOptions = {
  /** Cap'i aşan satırlar yazılmaz; sonuçta `truncated=true` görünür. */
  maxRows?: number;
};

export type CsvSinkResult = {
  csv: string;
  rowCount: number;
  truncated: boolean;
  cap?: number;
};

export interface CsvSink {
  /** Tek satır ekler. Cap aşılırsa false döner; export action `truncated=true` ile bildirebilir. */
  write(row: ReadonlyArray<unknown>): boolean;
  /** Birikmiş satırları finalize eder. */
  finalize(): CsvSinkResult;
}

/**
 * Bellek tabanlı sink (mevcut export'ların davranışı).
 * Cap aşılırsa ek satırlar yazılmaz, ama önceki satırlar kaybedilmez.
 */
export function createInMemoryCsvSink(headers: string[], options?: CsvSinkOptions): CsvSink {
  const rows: ReadonlyArray<unknown>[] = [];
  const cap = options?.maxRows;
  let truncated = false;
  return {
    write(row) {
      if (cap !== undefined && rows.length >= cap) {
        truncated = true;
        return false;
      }
      rows.push(row);
      return true;
    },
    finalize() {
      return {
        csv: buildCsv(headers, rows),
        rowCount: rows.length,
        truncated,
        cap,
      };
    },
  };
}

/**
 * Tüm satırları tek seferde döndüren convenience helper.
 * Mevcut `buildCsv` çağrılarının yerini doğrudan alır; ileride streaming
 * sink'e geçilmek istenirse signature aynı kalır.
 */
export function buildCsvFromRows(
  headers: string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
  options?: CsvSinkOptions
): CsvSinkResult {
  const sink = createInMemoryCsvSink(headers, options);
  for (const row of rows) {
    if (!sink.write(row)) break;
  }
  return sink.finalize();
}
