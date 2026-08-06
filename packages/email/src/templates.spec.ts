import { describe, expect, it } from 'vitest';

import { renderMailTemplate } from './templates.js';

describe('renderMailTemplate', () => {
  describe('platformSmoke', () => {
    it('escapes HTML in message', () => {
      const rendered = renderMailTemplate('platformSmoke', {
        message: '<script>alert(1)</script>',
      });

      expect(rendered.html).not.toContain('<script>');
      expect(rendered.html).toContain('&lt;script&gt;');
      expect(rendered.text).toBe('<script>alert(1)</script>');
    });
  });

  describe('passwordReset', () => {
    it('includes escaped reset url and optional userName', () => {
      const rendered = renderMailTemplate('passwordReset', {
        url: 'https://example.com/reset-password?token=ab<c',
        userName: 'Ada<script>',
      });

      expect(rendered.subject).toContain('密码');
      expect(rendered.html).toContain('https://example.com/reset-password?token=ab&lt;c');
      expect(rendered.html).toContain('Ada&lt;script&gt;');
      expect(rendered.html).not.toContain('<script>');
      expect(rendered.text).toContain('https://example.com/reset-password?token=ab<c');
      expect(rendered.text).toContain('Ada<script>');
    });

    it('uses a generic greeting when userName is omitted', () => {
      const rendered = renderMailTemplate('passwordReset', {
        url: 'https://example.com/reset-password?token=t',
      });

      expect(rendered.html).toContain('你好');
      expect(rendered.text).toContain('你好');
    });
  });

  describe('emailVerification', () => {
    it('includes escaped verification url and optional userName', () => {
      const rendered = renderMailTemplate('emailVerification', {
        url: 'https://example.com/api/auth/verify-email?token=ab<c',
        userName: 'Ada<script>',
      });

      expect(rendered.subject).toContain('邮箱');
      expect(rendered.html).toContain('https://example.com/api/auth/verify-email?token=ab&lt;c');
      expect(rendered.html).toContain('Ada&lt;script&gt;');
      expect(rendered.html).not.toContain('<script>');
      expect(rendered.text).toContain('https://example.com/api/auth/verify-email?token=ab<c');
      expect(rendered.text).toContain('Ada<script>');
    });

    it('uses a generic greeting when userName is omitted', () => {
      const rendered = renderMailTemplate('emailVerification', {
        url: 'https://example.com/api/auth/verify-email?token=t',
      });

      expect(rendered.html).toContain('你好');
      expect(rendered.text).toContain('你好');
    });
  });
});
