/**
 * Faz 8.9 — Wellness archive pagination configuration.
 *
 * `"use server"` dosyaları yalnızca async fonksiyon export'una izin verir.
 * Bu modül client/server her iki taraftan da güvenle import edilir.
 */

export const WELLNESS_ARCHIVE_DEFAULT_PAGE_SIZE = 200;
export const WELLNESS_ARCHIVE_MAX_PAGE_SIZE = 500;

export type WellnessArchiveFilter = {
  fromDate?: string | null;
  toDate?: string | null;
  page?: number | null;
  pageSize?: number | null;
};
