const READER_SELECTION = {
  MAX_LENGTH: 500,
} as const

type ReaderSelection = (typeof READER_SELECTION)[keyof typeof READER_SELECTION]

export { READER_SELECTION }
export type { ReaderSelection }
