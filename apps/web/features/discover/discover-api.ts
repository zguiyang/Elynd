import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type Article,
  DEFAULT_DISCOVER_SORT_BY,
  discoverListDataSchema,
  type DiscoverListQuery,
} from '@gloaming/shared/api/articles';
import { DEFAULT_PAGE, DEFAULT_SORT_ORDER } from '@gloaming/shared/api/pagination';
import type { ShelfData, ShelfItem } from '@gloaming/shared/api/shelf';

import {
  DISCOVER_PAGE_SIZE,
  type DiscoverItem,
  type DiscoverShelfStatus,
  type DiscoverThemeFilter,
} from '@/features/discover/discover-model';
import { addArticleToShelf } from '@/features/reader/reader-api';
import { getShelf, shelfQueryKey } from '@/features/shelf/shelf-api';
import { apiRequest, formatApiError } from '@/lib/api-request';

export type DiscoverListParams = Partial<Pick<DiscoverListQuery, 'page' | 'pageSize' | 'theme' | 'q'>>;

export type DiscoverCatalogResult = {
  items: DiscoverItem[];
  themes: string[];
  pagination: DiscoverListData['pagination'];
};

type DiscoverListData = {
  items: Article[];
  themes: string[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export const discoverQueryKey = {
  all: ['discover'] as const,
  list: (params: DiscoverListParams) => [...discoverQueryKey.all, 'list', params] as const,
};

function toIsoString(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }
  return typeof value === 'string' ? value : value.toISOString();
}

function buildListQuery(params: DiscoverListParams): string {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? DEFAULT_PAGE));
  search.set('pageSize', String(params.pageSize ?? DISCOVER_PAGE_SIZE));
  search.set('sortBy', DEFAULT_DISCOVER_SORT_BY);
  search.set('sortOrder', DEFAULT_SORT_ORDER);
  if (params.theme) {
    search.set('theme', params.theme);
  }
  if (params.q) {
    search.set('q', params.q);
  }
  return search.toString();
}

export async function listDiscoverArticles(
  params: DiscoverListParams = {},
  init?: { signal?: AbortSignal },
): Promise<DiscoverListData> {
  const qs = buildListQuery(params);
  return apiRequest(`/api/articles?${qs}`, {
    schema: discoverListDataSchema,
    signal: init?.signal,
  });
}

export function buildShelfItemMap(data: ShelfData): Map<string, ShelfItem> {
  const map = new Map<string, ShelfItem>();
  if (data.current) {
    map.set(data.current.article.id, data.current);
  }
  for (const item of data.items) {
    map.set(item.article.id, item);
  }
  return map;
}

export function resolveShelfStatus(item?: ShelfItem): DiscoverShelfStatus {
  if (!item) {
    return 'available';
  }
  if (item.progress.status === 'in_progress' && item.progress.progressRatio > 0) {
    return 'in_progress';
  }
  return 'on_shelf';
}

/** Map API article row to DiscoverItem — never reads `body`. */
export function toDiscoverItem(article: Article, shelfItem?: ShelfItem): DiscoverItem {
  const shelfStatus = resolveShelfStatus(shelfItem);
  return {
    id: article.id,
    title: article.title,
    level: article.level,
    themes: article.themes,
    estimatedMinutes: article.estimatedMinutes,
    publishedAt: toIsoString(article.publishedAt) || toIsoString(article.createdAt),
    shelfStatus,
    progressRatio: shelfItem?.progress.progressRatio ?? null,
    sourceLabel: '官方',
  };
}

export async function fetchDiscoverCatalog(
  params: DiscoverListParams,
  init?: { signal?: AbortSignal },
): Promise<DiscoverCatalogResult> {
  const [listData, shelfData] = await Promise.all([listDiscoverArticles(params, init), getShelf(init)]);
  const shelfMap = buildShelfItemMap(shelfData);
  return {
    items: listData.items.map((article) => toDiscoverItem(article, shelfMap.get(article.id))),
    themes: listData.themes,
    pagination: listData.pagination,
  };
}

export function useDiscoverCatalogQuery(params: DiscoverListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: discoverQueryKey.list(params),
    queryFn: ({ signal }) => fetchDiscoverCatalog(params, { signal }),
    enabled: options?.enabled ?? true,
  });
}

export function useAddToShelfMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (articleId: string) => addArticleToShelf(articleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: shelfQueryKey.all });
      await queryClient.invalidateQueries({ queryKey: discoverQueryKey.all });
    },
  });
}

export function themeFilterParam(theme: DiscoverThemeFilter): string | undefined {
  return theme === '全部' ? undefined : theme;
}

export const formatDiscoverApiError = formatApiError;
