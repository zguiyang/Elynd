import { describe, expect, it } from 'vitest';

import {
  clearPromptTemplateCache,
  composePromptMessages,
  PROMPT_ROLE,
  PROMPT_SCENE,
  renderPrompt,
} from '@/lib/prompts';
import { resolveAssistToolsForAction } from '@/modules/assist/tools';

describe('prompt compose', () => {
  it('renders mustache optional blocks', async () => {
    clearPromptTemplateCache();
    const withNeighbor = await renderPrompt('scenes/assist-read/user', {
      selection: 'hello',
      neighbor: '…hello world…',
    });
    expect(withNeighbor).toContain('Selection:');
    expect(withNeighbor).toContain('hello');
    expect(withNeighbor).toContain('Nearby context');
    expect(withNeighbor).not.toContain('Learner question');

    const withQuestion = await renderPrompt('scenes/assist-read/user', {
      selection: 'hello',
      question: 'What does this mean?',
    });
    expect(withQuestion).toContain('Learner question');
    expect(withQuestion).not.toContain('Nearby context');
  });

  it('composes language-teacher + assist-read + lookup without explain grammar task', async () => {
    clearPromptTemplateCache();
    const messages = await composePromptMessages({
      roleId: PROMPT_ROLE.languageTeacher,
      sceneId: PROMPT_SCENE.assistRead,
      actionId: 'lookup',
      vars: {
        targetLanguage: 'English',
        replyLanguage: 'Chinese',
        articleTitle: 'Sample',
        articleLevel: 'easy',
        selection: 'orbit',
        neighbor: 'the planet orbit',
      },
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.role).toBe('user');
    const system = messages[0]!.content;
    expect(system).toContain('language teacher');
    expect(system).toContain('word card');
    expect(system).toContain('Sample');
    expect(system).not.toContain('Explain the selected text in clear Chinese');
    expect(system).toMatch(/Do not[\s\S]*grammar/i);
    expect(messages[1]!.content).toContain('orbit');
  });

  it('maps explain action to meaning template', async () => {
    clearPromptTemplateCache();
    const messages = await composePromptMessages({
      roleId: PROMPT_ROLE.languageTeacher,
      sceneId: PROMPT_SCENE.assistRead,
      actionId: 'explain',
      vars: {
        targetLanguage: 'English',
        replyLanguage: 'Chinese',
        articleTitle: 'Sample',
        articleLevel: 'easy',
        selection: 'a long sentence',
      },
    });
    expect(messages[0]!.content).toContain('meaning and structure');
    expect(messages[0]!.content).not.toContain('word card');
  });
});

describe('resolveAssistToolsForAction', () => {
  const article = { title: 'T', body: 'hello world hello' };

  it('gives lookup search only', () => {
    const tools = resolveAssistToolsForAction('lookup', article);
    expect(tools.map((t) => t.name)).toEqual(['search_article']);
  });

  it('gives meaning slice and search', () => {
    const tools = resolveAssistToolsForAction('meaning', article);
    expect(tools.map((t) => t.name)).toEqual(['get_article_slice', 'search_article']);
  });
});
