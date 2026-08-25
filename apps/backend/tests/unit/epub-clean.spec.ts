import { describe, expect, it } from 'vitest';

import { cleanXhtml } from '@/modules/epub-ingest/clean';

describe('cleanXhtml', () => {
  it('keeps allowed tags and strips dangerous ones', () => {
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
    expect(html).not.toContain('nav');
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

  it('rewrites local image srcs and drops external/data images', () => {
    const { html, images } = cleanXhtml(
      `<p><img src="images/fig1.png"/><img src="https://cdn.example/x.jpg"/><img src="data:image/png;base64,AAAA"/></p>`,
      (src) => `/img/${src}`,
    );
    expect(html).toContain('src="/img/images/fig1.png"');
    expect(html).not.toContain('cdn.example');
    expect(html).not.toContain('data:image');
    expect(images).toEqual([{ href: 'images/fig1.png', mime: 'image/png' }]);
  });

  it('unwraps non-whitelisted tags but keeps their children', () => {
    const { html } = cleanXhtml(`<p>Before <span class="x">inner</span> after</p>`, () => '');
    expect(html).toContain('inner');
    expect(html).not.toContain('<span');
    expect(html).not.toContain('class="x"');
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
});
