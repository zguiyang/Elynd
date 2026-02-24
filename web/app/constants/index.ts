const ORDER_BY = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt'
} as const

type _OrderBy = (typeof ORDER_BY)[keyof typeof ORDER_BY]

const VIEW_MODE = {
  MASONRY: 'masonry',
  LIST: 'list'
} as const

type _ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE]

const SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc'
} as const

type _SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER]

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100
} as const

type _Pagination = (typeof PAGINATION)[keyof typeof PAGINATION]

const SORT_BY_OPTIONS = [
  { label: '更新时间', value: 'updatedAt' },
  { label: '创建时间', value: 'createdAt' }
]

const SORT_ORDER_OPTIONS = [
  { label: '倒序', value: 'desc' },
  { label: '正序', value: 'asc' }
]

const BOOKMARK_STATUS = {
  FETCHING: 'fetching',
  ACTIVE: 'active',
  ARCHIVED: 'archived'
} as const

const BOOKMARK_EVENTS = {
  BOOKMARK_UPDATED: 'bookmark.updated',
  IMPORT_PROGRESS: 'bookmark.import.progress'
} as const

const TRANSMIT_CHANNEL_NAMES = {
  BOOKMARKS: 'bookmarks'
} as const

const APP_INFO = {
  NAME: 'Elynd',
  VERSION: '0.0.0',
  COPYRIGHT_YEAR: '2026'
} as const

const TAG_ITEM_TYPE = {
  BOOKMARK: 'bookmark',
  MEMO: 'memo'
} as const

type _TagItemType = (typeof TAG_ITEM_TYPE)[keyof typeof TAG_ITEM_TYPE]

export {
  ORDER_BY,
  VIEW_MODE,
  SORT_ORDER,
  PAGINATION,
  SORT_BY_OPTIONS,
  SORT_ORDER_OPTIONS,
  BOOKMARK_STATUS,
  BOOKMARK_EVENTS,
  TRANSMIT_CHANNEL_NAMES,
  APP_INFO,
  TAG_ITEM_TYPE
}

export type {
  _OrderBy as OrderBy,
  _ViewMode as ViewMode,
  _SortOrder as SortOrder,
  _Pagination as Pagination,
  _TagItemType as TagItemType
}
