/** Prompt role ids (persona files under `prompts/roles/`). */
export const PROMPT_ROLE = {
  languageTeacher: 'language-teacher',
} as const;

export type PromptRoleId = (typeof PROMPT_ROLE)[keyof typeof PROMPT_ROLE];

/** Reserved role ids for future scenes (no template files yet). */
export const PROMPT_ROLE_RESERVED = ['progress-coach', 'practice-coach'] as const;

/** Prompt scene ids (directories under `prompts/scenes/`). */
export const PROMPT_SCENE = {
  assistRead: 'assist-read',
  translateArticle: 'translate-article',
} as const;

export type PromptSceneId = (typeof PROMPT_SCENE)[keyof typeof PROMPT_SCENE];

/** Reserved scene ids for future product surfaces. */
export const PROMPT_SCENE_RESERVED = ['home-checkin', 'practice-drill'] as const;

/** Map assist API actionId → template filename under `scenes/assist-read/actions/`. */
export const ASSIST_ACTION_TEMPLATE: Record<string, string> = {
  lookup: 'lookup',
  meaning: 'meaning',
  explain: 'meaning',
  simpler: 'simpler',
  referent: 'referent',
  qa: 'qa',
  gist: 'gist',
};
