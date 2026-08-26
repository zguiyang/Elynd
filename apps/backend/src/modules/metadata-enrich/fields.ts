export const METADATA_FIELD_IDS = ['description', 'tags', 'category', 'source'] as const;

export type MetadataFieldId = (typeof METADATA_FIELD_IDS)[number];

/** Maximum AI-produced tags per work (conservative vs. the manual cap of 10). */
export const AI_TAG_MAX_ITEMS = 6 as const;

/** Maximum AI description length — aligned with WORK_DESCRIPTION_MAX. */
export const AI_DESCRIPTION_MAX = 2000 as const;
