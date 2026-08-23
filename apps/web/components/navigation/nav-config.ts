import { AUTH_ROUTES } from '@/constants';

/** Shared copy for site / app chrome (Chinese system UI). */
export const NAV_COPY = {
  wordmark: 'Gloaming',
  discover: '发现',
  shelf: '我的书架',
  shelfShort: '书架',
  history: '阅读历史',
  historyShort: '历史',
  more: '更多',
  signIn: '登录',
  searchPlaceholder: '搜索…',
  account: '账户菜单',
  signOut: '退出登录',
  admin: '管理后台',
  moreSheetTitle: '更多',
  moreSheetDescription: '账户与扩展入口',
  morePlaceholderSettings: '设置',
  morePlaceholderAccount: '账户',
  morePlaceholderHint: '即将开放',
  moreFutureHint: '后续模块入口将出现在这里。',
} as const;

export type PrimaryNavId = 'shelf' | 'discover' | 'history';

export type PrimaryNavLink = {
  id: PrimaryNavId;
  href: string;
  /** Full label (desktop top nav). */
  label: string;
  /** Compact label (mobile bottom nav). */
  shortLabel: string;
};

/** Desktop top-nav order (unchanged): 发现 → 书架 → 历史. */
export const PRIMARY_NAV_LINKS: readonly PrimaryNavLink[] = [
  { id: 'discover', href: AUTH_ROUTES.discover, label: NAV_COPY.discover, shortLabel: NAV_COPY.discover },
  { id: 'shelf', href: AUTH_ROUTES.shelf, label: NAV_COPY.shelf, shortLabel: NAV_COPY.shelfShort },
  { id: 'history', href: AUTH_ROUTES.history, label: NAV_COPY.history, shortLabel: NAV_COPY.historyShort },
] as const;

/** Mobile bottom-nav order: 书架 → 发现 → 历史 (+ 更多 handled separately). */
export const MOBILE_PRIMARY_TAB_IDS: readonly PrimaryNavId[] = ['shelf', 'discover', 'history'] as const;

export function getPrimaryNavLink(id: PrimaryNavId): PrimaryNavLink {
  const link = PRIMARY_NAV_LINKS.find((item) => item.id === id);
  if (!link) {
    throw new Error(`Unknown primary nav id: ${id}`);
  }
  return link;
}

export function matchesNavPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
