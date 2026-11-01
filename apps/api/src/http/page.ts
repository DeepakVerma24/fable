export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  simulated: true;
  demo: true;
}

export function paginate<T>(items: readonly T[], query: PageQuery): Page<T> {
  const pageSize = Math.min(Math.max(query.pageSize ?? 24, 1), 50);
  const page = Math.max(query.page ?? 1, 1);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
    simulated: true,
    demo: true,
  };
}
