export const DIRECTORY_DEFAULT_PAGE_SIZE = 30;
export const DIRECTORY_MAX_PAGE_SIZE = 100;

export type DirectoryPagination = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

export function normalizeDirectoryPagination(
  page?: number,
  pageSize?: number,
  maxPageSize = DIRECTORY_MAX_PAGE_SIZE
): DirectoryPagination {
  const p = Number.isFinite(page) ? Math.max(1, Math.floor(page as number)) : 1;
  const size = Number.isFinite(pageSize)
    ? Math.min(maxPageSize, Math.max(1, Math.floor(pageSize as number)))
    : DIRECTORY_DEFAULT_PAGE_SIZE;
  const from = (p - 1) * size;
  return { page: p, pageSize: size, from, to: from + size - 1 };
}

export function totalDirectoryPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
