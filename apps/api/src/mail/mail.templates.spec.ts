import { describe, expect, it } from 'vitest';

import { renderMailTemplate } from './mail.templates.js';

describe('renderMailTemplate', () => {
  describe('MAIL-007 html escape', () => {
    it('escapes HTML in platformSmoke message', () => {
      const rendered = renderMailTemplate('platformSmoke', {
        message: '<script>alert(1)</script>',
      });

      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).toContain('&lt;script&gt;');
      expect(rendered.text).toBe('<script>alert(1)</script>');
    });
  });
});
