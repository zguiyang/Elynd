export type ReaderActionType = 'lookup' | 'explain' | 'qa' | 'translate'

export interface ReaderSelectionMeta {
  anchorX?: number
  anchorY?: number
}

export interface ReaderSelectionActionPayload {
  actionType: ReaderActionType
  selectedText: string
  selectionMeta?: ReaderSelectionMeta
  chapterIndex?: number
}

export interface ReaderAiActionRequest {
  actionType: Exclude<ReaderActionType, 'lookup'>
  selectedText: string
  chapterIndex?: number
}
