import { describe, expect, it } from 'vitest';

import { cleanXhtml, stripOrphanImagePlaceholders } from '@/modules/epub-ingest/clean';

describe('cleanXhtml', () => {
  it('keeps allowed tags and strips dangerous ones (blacklist)', () => {
    const { html } = cleanXhtml(
      `<html><head><title>T</title></head><body>
        <p>Safe <em>text</em>.</p>
        <script>alert(1)</script>
        <style>p{color:red}</style>
        <iframe src="https://evil.example"></iframe>
        <nav><a href="#">home</a></nav>
      </body></html>`,
      () => '',
    );
    expect(html).toContain('<p');
    expect(html).toContain('<em>text</em>');
    expect(html).not.toContain('script');
    expect(html).not.toContain('style');
    expect(html).not.toContain('iframe');
    // Blacklist approach keeps nav (textstack behavior).
    expect(html).toContain('<nav');
  });

  it('removes on* attributes and dangerous URL schemes', () => {
    const { html } = cleanXhtml(
      `<p onclick="alert(1)" onmouseover="x()">Hi <a href="javascript:alert(1)">bad</a> <a href="/relative">good</a></p>`,
      () => '',
    );
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onmouseover');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="/relative"');
  });

  it('rewrites local image srcs and keeps external/data images', () => {
    const { html, images } = cleanXhtml(
      `<p><img src="images/fig1.png"/><img src="https://cdn.example/x.jpg"/><img src="data:image/png;base64,AAAA"/></p>`,
      (src) => `/img/${src}`,
    );
    expect(html).toContain('src="/img/images/fig1.png"');
    expect(html).toContain('cdn.example');
    expect(html).toContain('data:image');
    expect(images).toEqual([{ href: 'images/fig1.png', mime: 'image/png' }]);
  });

  it('keeps structure tags like span (blacklist)', () => {
    const { html } = cleanXhtml(`<p>Before <span class="x">inner</span> after</p>`, () => '');
    expect(html).toContain('inner');
    expect(html).toContain('<span');
    expect(html).toContain('class="x"');
  });

  it('injects data-p ordinals on block elements', () => {
    const { html } = cleanXhtml(`<p>One</p><blockquote>Two</blockquote><p>Three</p>`, () => '');
    expect(html).toContain('data-p="0"');
    expect(html).toContain('data-p="1"');
    expect(html).toContain('data-p="2"');
  });

  it('keeps footnote markers (sup) in HTML but drops empty paragraphs', () => {
    const { html } = cleanXhtml(`<p>Text<sup>1</sup>.</p><p>   </p>`, () => '');
    expect(html).toContain('Text');
    expect(html).toContain('<sup>1</sup>');
  });

  it('preserves ../ in local hrefs passed to rewriteImageSrc', () => {
    const seen: string[] = [];
    cleanXhtml(`<p><img src="../Images/fig.png"/></p>`, (src) => {
      seen.push(src);
      return `/img/${src}`;
    });
    expect(seen).toEqual(['../Images/fig.png']);
  });

  it('removes Gutenberg noimages figcenter stubs', () => {
    const { html } = cleanXhtml(
      `<html><body>
        <div class="figcenter"><a id="id_1"><span id="img_images_052-2.jpg">THE FOX AND THE STORK</span></a></div>
        <h2>THE WOLF</h2>
        <p>A Wolf resolved.</p>
      </body></html>`,
      () => '',
    );
    expect(html).not.toContain('THE FOX AND THE STORK');
    expect(html).not.toContain('img_images_');
    expect(html).not.toContain('figcenter');
    expect(html).toContain('THE WOLF');
    expect(html).toContain('A Wolf resolved.');
  });

  it('keeps real local images while dropping empty-src imgs', () => {
    const { html, images } = cleanXhtml(
      `<p><img src="a.png" alt="ok"/><img src="" alt="gone"/><img alt="also-gone"/></p>`,
      (src) => `/x/${src}`,
    );
    expect(html).toContain('src="/x/a.png"');
    expect(html).not.toContain('gone');
    expect(images).toEqual([{ href: 'a.png', mime: 'image/png' }]);
  });
});

describe('stripOrphanImagePlaceholders', () => {
  it('removes imgs whose placeholder was not resolved', () => {
    const keep = '__GLOAMING_IMG__keep__';
    const drop = '__GLOAMING_IMG__drop__';
    const html = `<p><img src="${keep}"/><img src="${drop}"/></p>`;
    const out = stripOrphanImagePlaceholders(html, new Set([keep]));
    expect(out).toContain(keep);
    expect(out).not.toContain(drop);
  });
});
