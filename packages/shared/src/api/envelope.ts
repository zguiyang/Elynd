import { z } from 'zod';

/** Successful API payload wrapper (`ApiSerializer` wrap: `data`). */
export function apiDataSchema<T extends z.ZodType>(data: T) {
  return z.object({ data });
}

export type ApiData<T> = { data: T };

/**
 * Lucid SimplePaginator default meta keys (camelCase naming strategy).
 * @see `@adonisjs/lucid` SimplePaginator.getMeta()
 */
export const paginationMetaSchema = z.object({
  total: z.number(),
  perPage: z.number(),
  currentPage: z.number(),
  lastPage: z.number(),
  firstPage: z.number(),
  firstPageUrl: z.string(),
  lastPageUrl: z.string(),
  nextPageUrl: z.string().nullable(),
  previousPageUrl: z.string().nullable(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export function apiPaginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: paginationMetaSchema,
  });
}

export type ApiPaginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

/** Adonis Vine validation failure body for JSON API clients (HTTP 422). */
export const apiFieldErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
  rule: z.string().optional(),
});

export const apiValidationErrorSchema = z.object({
  errors: z.array(apiFieldErrorSchema),
});

export type ApiFieldError = z.infer<typeof apiFieldErrorSchema>;
export type ApiValidationError = z.infer<typeof apiValidationErrorSchema>;
