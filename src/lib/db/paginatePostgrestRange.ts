const DEFAULT_PAGE_SIZE = 1000;

export async function paginatePostgrestSelect<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<{ data: T[]; error: null } | { data: null; error: { message: string } }> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      return { data: null, error };
    }

    const page = data ?? [];
    if (page.length === 0) {
      break;
    }

    rows.push(...page);
    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { data: rows, error: null };
}
