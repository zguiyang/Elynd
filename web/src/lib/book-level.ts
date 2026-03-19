interface BookLevelLike {
  minWords?: number | null
  maxWords?: number | null
  description?: string | null
}

export function formatBookLevelRange(level: BookLevelLike, unit = '词') {
  const minWords = level.minWords ?? null
  const maxWords = level.maxWords ?? null

  if (minWords !== null && maxWords !== null) {
    const displayMin = minWords > 0 ? minWords - 1 : 0
    return `${displayMin}-${maxWords}${unit}`
  }

  if (minWords !== null && maxWords === null) {
    const displayMin = minWords > 0 ? minWords - 1 : 0
    return `${displayMin}+${unit}`
  }

  if (level.description && level.description.trim().length > 0) {
    return `${level.description.trim()}${unit}`
  }

  return `未知${unit}`
}
