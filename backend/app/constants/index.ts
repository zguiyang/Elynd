const ORDER_BY = {
  CREATED_AT: 'createdAt',
  UPDATED_AT: 'updatedAt',
  TITLE: 'title',
} as const

type OrderBy = (typeof ORDER_BY)[keyof typeof ORDER_BY]

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 20,
  MAX_PER_PAGE: 100,
} as const

type Pagination = (typeof PAGINATION)[keyof typeof PAGINATION]

const SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER]

const VALIDATION = {
  TITLE_MIN: 1,
  TITLE_MAX: 200,
  DESCRIPTION_MAX: 500,
  TAG_NAME_MIN: 1,
  TAG_NAME_MAX: 100,
  COLOR_HEX_LENGTH: 7,
  METADATA_MAX_SIZE: 65535,
  PASSWORD_MIN: 8,
  EMAIL_VERIFICATION_EXPIRY_MINUTES: 30,
  VERIFICATION_RESEND_COOLDOWN_MINUTES: 1,
} as const

type Validation = (typeof VALIDATION)[keyof typeof VALIDATION]

const EMAIL_VERIFICATION = {
  KEY_PREFIX: 'email_verify:',
  EXPIRY_MINUTES: 30,
  COOLDOWN_MINUTES: 1,
} as const

type EmailVerification = (typeof EMAIL_VERIFICATION)[keyof typeof EMAIL_VERIFICATION]

const AVATAR = {
  MAX_SIZE: 200 * 1024,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif'],
  STORAGE_DIR: 'storage/avatars',
  URL_PREFIX: '/avatars',
} as const

type Avatar = (typeof AVATAR)[keyof typeof AVATAR]

export { ORDER_BY, PAGINATION, SORT_ORDER, VALIDATION, EMAIL_VERIFICATION, AVATAR }
export type { OrderBy, Pagination, SortOrder, Validation, EmailVerification, Avatar }
