/**
 * Faz 9.2 — Large org query chunking helper.
 *
 * Problem:
 *   `.in("profile_id", profileIds[])` 1000+ ID'de PostgREST URL query payload
 *   limitine yaklaşır (~16KB) ve büyük org'larda 414 / timeout riski yaratır.
 *
 * Çözüm:
 *   - ID listesini chunk'lara böl (default 500).
 *   - Her chunk için verilen `runChunk` fonksiyonunu çağır.
 *   - Sonuçları sırasıyla birleştir (order'ı çağırıcı tekrar uygular).
 *   - Telemetry: chunk sayısı, total ID, başarı/başarısızlık.
 *
 * Kurallar:
 *   - Davranış parity: tek `.in()` ile aynı sonucu üretir (kaynaktaki order
 *     korunmaz; çağırıcı `.order()` çağrısını her chunk'a koymalı + sonuçta
 *     tekrar sortlama yapmalı, ya da result tarafta order indifferent olmalı).
 *   - Bir chunk fail olursa kalan chunk'lar iptal edilir (fail-fast).
 *   - Concurrent execution (Promise.all). Süre kazancı ama Supabase
 *     connection pool'una basınç olur; default `maxConcurrent = 4`.
 */

import { logger } from "@/lib/monitoring/logger";

export const DEFAULT_IN_CHUNK_SIZE = 500;
export const DEFAULT_IN_MAX_CONCURRENT = 4;

export type ChunkedInOptions = {
  chunkSize?: number;
  maxConcurrent?: number;
  scope?: string;
};

export type ChunkedInResult<T> = {
  rows: T[];
  chunkCount: number;
  totalIds: number;
  truncatedIds?: false;
};

export function chunkArray<T>(items: ReadonlyArray<T>, size: number): T[][] {
  const safeSize = Math.max(1, Math.floor(size));
  if (items.length <= safeSize) return items.length > 0 ? [items.slice() as T[]] : [];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    out.push(items.slice(i, i + safeSize) as T[]);
  }
  return out;
}

/**
 * Verilen `ids[]`'i chunk'lara böler, her chunk için `runChunk(chunk)` çağırır.
 * Sonuçları flatten edip döner. Hata olursa Supabase error nesnesi sarmalanır.
 */
export async function chunkedInQuery<T, E extends { message: string }>(
  ids: ReadonlyArray<string>,
  runChunk: (chunk: string[]) => Promise<{ data: T[] | null; error: E | null }>,
  options: ChunkedInOptions = {}
): Promise<{ data: T[]; error: null } | { data: null; error: E & { failedChunkIndex?: number } }> {
  const scope = options.scope ?? "chunkedInQuery";
  const chunkSize = options.chunkSize ?? DEFAULT_IN_CHUNK_SIZE;
  const maxConcurrent = Math.max(1, options.maxConcurrent ?? DEFAULT_IN_MAX_CONCURRENT);

  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const chunks = chunkArray(ids, chunkSize);
  if (chunks.length === 1) {
    const single = await runChunk(chunks[0]);
    if (single.error) {
      logger.warn(scope, "single chunk failed", { totalIds: ids.length, error: single.error.message });
      return { data: null, error: single.error as E & { failedChunkIndex: number } };
    }
    return { data: (single.data ?? []) as T[], error: null };
  }

  logger.info(scope, "chunked in query", {
    totalIds: ids.length,
    chunkCount: chunks.length,
    chunkSize,
    maxConcurrent,
  });

  const out: T[] = [];
  for (let batchStart = 0; batchStart < chunks.length; batchStart += maxConcurrent) {
    const batch = chunks.slice(batchStart, batchStart + maxConcurrent);
    const results = await Promise.all(
      batch.map(async (chunk, idx) => ({
        idx: batchStart + idx,
        result: await runChunk(chunk),
      }))
    );
    for (const { idx, result } of results) {
      if (result.error) {
        logger.warn(scope, "chunk failed", {
          chunkIndex: idx,
          chunkCount: chunks.length,
          totalIds: ids.length,
          error: result.error.message,
        });
        const err = result.error as E & { failedChunkIndex: number };
        err.failedChunkIndex = idx;
        return { data: null, error: err };
      }
      if (result.data && result.data.length > 0) {
        out.push(...(result.data as T[]));
      }
    }
  }
  return { data: out, error: null };
}
