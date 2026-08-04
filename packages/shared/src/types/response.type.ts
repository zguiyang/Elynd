export const PaginationDirectionEnum = {
  ASC: 'asc',
  DESC: 'desc',
} as const;

export const PaginationDefaults = {
  PAGE: 1,
  PAGE_SIZE: 10,
  DIRECTION: PaginationDirectionEnum.DESC,
  DEFAULT_ORDER_BY: 'created_at',
} as const;

export type PaginatedData<T> = {
  content: T[];
  page: number;
  pages: number;
  pageSize: number;
  total: number;
};

export interface ErrorResponse {
  message: string;
  path: string;
  timestamp?: string;
}
