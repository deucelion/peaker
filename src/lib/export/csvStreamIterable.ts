/**
 * Faz 11.4 — Async-iterable / chunked CSV abstraction.
 *
 * Mevcut `createInMemoryCsvSink` tüm satırları RAM'de tutar. Bu yeterli
 * 5-10k satıra kadar. Daha büyük export'lar için:
 *
 *   - `CsvRowIterable`: caller'ın çağırdığı bir async iterator. Memory'de
 *     yalnızca aktif chunk tutulur.
 *   - `buildCsvFromIterable`: in-memory sink ile entegrasyon (geriye uyumlu).
 *   - `streamCsvToResponse`: ReadableStream üretir (HTTP route'larda direkt
 *     `Response.body` olarak kullanılabilir; bu turda export action'larında
 *     henüz aktif değil, Faz 12 route handler'a hazır).
 *
 * Davranış:
 *   - Aynı CSV format (UTF-8 BOM, ';' separator, CRLF, alıntı kuralları).
 *   - Cap: chunk iterator üreticisi cap'i yorumlar; sink `truncated=true`
 *     bildirir.
 */

import { buildCsv } from "./csv";
import {
  createInMemoryCsvSink,
  type CsvSink,
  type CsvSinkResult,
} from "./csvStream";

export type CsvChunk = ReadonlyArray<ReadonlyArray<unknown>>;

export type CsvRowIterable = AsyncIterable<CsvChunk>;

export type CsvIterableOptions = {
  maxRows?: number;
};

/**
 * Async iterable'dan tek pass CSV oluşturur. Sink in-memory; ileride
 * `streamCsvToResponse` ile değiştirilebilir.
 */
export async function buildCsvFromIterable(
  headers: string[],
  iterable: CsvRowIterable,
  options?: CsvIterableOptions
): Promise<CsvSinkResult> {
  const sink: CsvSink = createInMemoryCsvSink(headers, options);
  for await (const chunk of iterable) {
    for (const row of chunk) {
      if (!sink.write(row)) {
        return sink.finalize();
      }
    }
  }
  return sink.finalize();
}

/**
 * HTTP route handler için ReadableStream üretici (Faz 12.4).
 *
 * Davranış garantileri (`buildCsv` ile parity):
 *   - Tek UTF-8 BOM (\uFEFF) baş tarafta.
 *   - Header satırı CRLF ile biter.
 *   - Her veri satırı ; separator + RFC 4180-ish quoting + CRLF.
 *   - Cap aşılırsa controller stream'i kapatır; truncated=true callback'le bildirilir.
 *
 * `onComplete` opsiyoneldir; rowCount + truncated bilgisini caller'a vermek
 * için kullanılır. Header response'da bu bilgi `X-Peaker-Row-Count` ve
 * `X-Peaker-Truncated` üzerinden iletilir (route handler tarafından).
 *
 * Abort handling (Faz 14.1):
 *   - `callbacks.signal` iptalinde döngü kırılır; `controller.close()` ile
 *     kısmi CSV güvenli kapanır (error fırlatılmaz).
 *   - `onAbort` + telemetry route tarafında bağlanır.
 */

export type StreamCsvCallbacks = {
  onComplete?: (info: { rowCount: number; truncated: boolean; cap?: number }) => void;
  /** İstemci iptal / timeout / bağlantı kopması (AbortSignal). */
  signal?: AbortSignal | null;
  onAbort?: (info: { rowCount: number; truncated: boolean; cap?: number }) => void;
  /** Her satır yazımından sonra (telemetry / UI progress için). */
  onProgress?: (info: { rowsEmitted: number }) => void;
};

export function streamCsvToResponse(
  headers: string[],
  iterable: CsvRowIterable,
  options?: CsvIterableOptions,
  callbacks?: StreamCsvCallbacks
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const cap = options?.maxRows;
  let rowCount = 0;
  let truncated = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const signal = callbacks?.signal ?? null;
      try {
        // buildCsv(headers, []) zaten BOM + header + "\r\n" döndürür; tek
        // çağrı yeterli.
        controller.enqueue(encoder.encode(buildCsv(headers, [])));
        for await (const chunk of iterable) {
          if (signal?.aborted) break;
          if (truncated) break;
          for (const row of chunk) {
            if (signal?.aborted) break;
            if (cap !== undefined && rowCount >= cap) {
              truncated = true;
              break;
            }
            // buildCsv([], [row]) → BOM + "" + "\r\n" + row + "\r\n".
            // İlk satırda zaten BOM emit ettik; tekrar etmemek için BOM'u
            // strip ediyoruz ve baştaki boş CRLF'i de.
            const stripped = buildCsv([], [row]).replace(/^\ufeff\r\n/, "");
            controller.enqueue(encoder.encode(stripped));
            rowCount += 1;
            callbacks?.onProgress?.({ rowsEmitted: rowCount });
          }
          if (signal?.aborted || truncated) break;
        }
        const aborted = Boolean(signal?.aborted);
        controller.close();
        if (aborted) {
          callbacks?.onAbort?.({ rowCount, truncated, cap });
        } else {
          callbacks?.onComplete?.({ rowCount, truncated, cap });
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

/**
 * Chunked array helper — kaynak Promise<T[]> -> AsyncIterable<CsvChunk>
 * map'i basitleştirmek için.
 */
export async function* chunkedCsvIterable<T>(
  source: () => Promise<ReadonlyArray<T>>,
  mapRow: (row: T) => ReadonlyArray<unknown>,
  chunkSize: number = 500
): AsyncIterable<CsvChunk> {
  const rows = await source();
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    yield slice.map(mapRow);
  }
}
