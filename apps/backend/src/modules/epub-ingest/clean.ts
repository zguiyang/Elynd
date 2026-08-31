import * as cheerio from 'cheerio';

import { applyTextPipeline } from './text-pipeline';
import type { ChapterImageRef } from './types';

/**
 * XHTML → normalized reading HTML.
 *
 * Cleaning follows textstack's HtmlCleaner (blacklist approach): only
 * dangerous tags/attributes are removed, all other structure (div/table/span/
 * i/b/abbr/svg/…) is preserved so parsed content matches the reference
 * product. On top of that Gloaming adds:
 * - NFC normalization + self-closing tag repair (parse5 would swallow the rest
 *   of the document after a self-closing non-void tag like `<title/>`).
 * - `data-p` ordinals on block elements for reader paragraph anchoring.
 * - Removal of in-chapter table-of-contents blocks (the product has its own
 *   chapter navigation, so a duplicated contents page is dropped).
 * - Removal of non-displayable figure stubs (Gutenberg `epub.noimages` spans,
 *   empty imgs) so reading is not interrupted by caption-only placeholders.
 * - Removal of empty reading chrome (br-only wrappers, leading decorative hrs)
 *   left behind after stub stripping.
 * - The text pipeline (whitespace / entities / empty tags).
 *
 * Local img srcs are placeholder-tokenized (rewritten to asset URLs by the
 * ingest orchestrator); external http(s) and data:image srcs are preserved
 * (textstack behavior).
 */

/** Tags removed entirely with their subtree (textstack DangerousTags + head). */
const DANGEROUS_TAGS = new Set([
  'head',
  'script',
  'style',
  'link',
  'iframe',
  'object',
  'embed',
  'base',
  'form',
  'meta',
  'noscript',
  'frame',
  'frameset',
  'applet',
]);

/** URL-bearing attributes scrubbed with the same scheme allowlist as href. */
const URL_ATTRS = ['href', 'src', 'srcset', 'data', 'action', 'formaction', 'poster', 'background', 'xlink:href'];

const DANGEROUS_SCHEME = /^(javascript|vbscript|file|blob):/i;

/** Block-level elements that receive a data-p ordinal. */
const BLOCK_TAGS = new Set([
  'p',
  'div',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'pre',
  'figure',
  'section',
  'table',
  'dl',
  'address',
]);

/** Self-closing tag names — the only ones allowed to keep `/>` form. */
const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/** In-chapter contents headings whose following link list is dropped. */
const CONTENTS_TITLES = new Set(['contents', 'table of contents']);

/** Ingest placeholder token prefix — must match epub-ingest/parser. */
export const IMAGE_PLACEHOLDER_PREFIX = '__GLOAMING_IMG__';

const FIGURE_SHELL_SELECTOR = '.figcenter, .figleft, .figright, figure';

export function isLocalImageHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (/^(https?:|data:|blob:|\/\/)/i.test(trimmed)) return false;
  return true;
}

export type CleanResult = {
  html: string;
  /** Sorted unique local image refs found in the cleaned HTML. */
  images: ChapterImageRef[];
};

function detectImageMime(src: string): string {
  const lower = src.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

/** Decode percent-encoding when present; keep `../` for chapter-relative resolve. */
function softNormalizeLocalHref(href: string): string {
  const noHash = href.trim().split('#')[0]!.trim();
  if (!noHash) return '';
  try {
    return decodeURIComponent(noHash);
  } catch {
    return noHash;
  }
}

/**
 * Repair self-closing non-void tags. HTML5 parsing ignores `/>` on non-void
 * elements, so `<title/>` (and `<div/>` etc.) would swallow everything until
 * its closing tag — parse5 then loses the whole body. textstack fixes only
 * script/title for HtmlAgilityPack; parse5 needs the full non-void set.
 */
function fixSelfClosingTags(html: string): string {
  return html.replace(/<([a-z][a-z0-9]*)(\s[^>]*)?\/>/gi, (match, tag: string, attrs: string | undefined) => {
    if (VOID_TAGS.has(tag.toLowerCase())) return match;
    return `<${tag}${attrs ?? ''}></${tag}>`;
  });
}

/**
 * Scheme allowlist for URL attributes (textstack SanitizeUrl): entities are
 * already decoded by the parser and control characters stripped before
 * matching. Returns the value unchanged when safe, a `#`-anchor downgrade for
 * dangerous hrefs, or null to remove the attribute.
 */
function sanitizeUrl(attrName: string, value: string): string | null {
  const collapsed = value.replace(/[\t\n\r\f\0 ]/g, '');
  const firstUrl = attrName === 'srcset' ? collapsed.split(',')[0]!.split(' ')[0]! : collapsed;
  const lower = firstUrl.toLowerCase();
  const isNavigational = attrName === 'href' || attrName === 'xlink:href';
  const dataImageOk = lower.startsWith('data:image/') && !isNavigational && !lower.startsWith('data:image/svg');
  const unsafe = DANGEROUS_SCHEME.test(lower) || (lower.startsWith('data:') && !dataImageOk);
  if (!unsafe) return value;
  if (isNavigational) {
    const hashIndex = value.indexOf('#');
    return hashIndex >= 0 ? value.slice(hashIndex) : '#';
  }
  return null;
}

function scrubAttributes($: cheerio.CheerioAPI): void {
  $('*').each((_, el) => {
    if (el.type !== 'tag') return;
    const $el = $(el);
    for (const attr of Object.keys(el.attribs ?? {})) {
      const name = attr.toLowerCase();
      if (name.startsWith('on')) {
        $el.removeAttr(attr);
        continue;
      }
      if (URL_ATTRS.includes(name)) {
        const value = $el.attr(attr) ?? '';
        if (!value) continue;
        const sanitized = sanitizeUrl(name, value);
        if (sanitized === null) {
          $el.removeAttr(attr);
        } else if (sanitized !== value) {
          $el.attr(attr, sanitized);
        }
      }
    }
  });
}

function removeDangerousTags($: cheerio.CheerioAPI): void {
  $([...DANGEROUS_TAGS].join(',')).remove();
}

/** Remove an img (or its empty figure shell) so reading is not interrupted. */
function removeImgOrFigureShell($: cheerio.CheerioAPI, $img: cheerio.Cheerio<never>): void {
  const $shell = $img.closest(FIGURE_SHELL_SELECTOR);
  if ($shell.length) {
    $shell.remove();
    return;
  }
  $img.remove();
}

/**
 * Rewrite/collect local images (placeholder token), keep external and
 * data:image srcs as-is (textstack behavior), drop srcset (single src wins —
 * local srcset entries cannot be proxied).
 *
 * `rewriteImageSrc` receives a soft-normalized local href (percent-decoded,
 * hash stripped, `../` preserved) so the caller can resolve against the
 * chapter directory.
 */
function collectImages(
  $: cheerio.CheerioAPI,
  rewriteImageSrc: (href: string) => string,
  images: ChapterImageRef[],
  seenImages: Set<string>,
): void {
  $('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') ?? '';
    $img.removeAttr('srcset');
    if (!isLocalImageHref(src)) {
      return;
    }
    const normalized = softNormalizeLocalHref(src);
    if (!normalized) {
      $img.remove();
      return;
    }
    const key = normalized.toLowerCase();
    if (!seenImages.has(key)) {
      seenImages.add(key);
      images.push({ href: normalized, mime: detectImageMime(normalized) });
    }
    $img.attr('src', rewriteImageSrc(normalized));
  });
}

/**
 * Drop Gutenberg noimages stubs and empty image shells. Ebookmaker converts
 * missing `<img>` into `<span id="img_{src}">alt</span>`; leaving those as
 * linked captions looks like a product bug during immersive reading.
 */
function removeNonDisplayableFigures($: cheerio.CheerioAPI): void {
  $('span[id^="img_"]').each((_, el) => {
    const $span = $(el);
    const $shell = $span.closest(FIGURE_SHELL_SELECTOR);
    if ($shell.length) {
      $shell.remove();
      return;
    }
    const $parent = $span.parent();
    if ($parent.is('a') && !$parent.attr('href') && $parent.children().length === 1) {
      $parent.remove();
      return;
    }
    $span.remove();
  });

  $('img').each((_, el) => {
    const $img = $(el);
    const src = ($img.attr('src') ?? '').trim();
    if (!src) {
      removeImgOrFigureShell($, $img as cheerio.Cheerio<never>);
    }
  });
}

/** True when an element carries no readable text and no images. */
function hasNoReadingContent($el: cheerio.Cheerio<never>): boolean {
  if ($el.find('img').length > 0) return false;
  return !$el
    .text()
    .replace(/\u00a0/g, ' ')
    .trim();
}

/**
 * Gutenberg spacer: `pg_body_wrapper` (and similar) that only holds `<br>` /
 * whitespace after figure stubs were removed.
 */
function isSpacerShell($el: cheerio.Cheerio<never>): boolean {
  const el = $el.get(0) as DomNode | undefined;
  if (!el || el.type !== 'tag') return false;
  const tag = (el.tagName ?? '').toLowerCase();
  if (tag !== 'div' && tag !== 'span' && tag !== 'p' && tag !== 'section') return false;
  if (!hasNoReadingContent($el)) return false;
  const cls = String($el.attr('class') ?? '').toLowerCase();
  if (cls.includes('pg_body_wrapper') || cls.includes('pg-body-wrapper')) return true;
  // Generic empty shell whose only element children are br/hr.
  let onlyBreaks = true;
  $el.contents().each((_, child) => {
    const node = child as DomNode;
    if (node.type === 'text') {
      if ((node.data ?? '').trim()) onlyBreaks = false;
      return;
    }
    if (node.type === 'tag') {
      const childTag = (node.tagName ?? '').toLowerCase();
      if (childTag !== 'br' && childTag !== 'hr') onlyBreaks = false;
    }
  });
  return onlyBreaks;
}

/**
 * Strip empty reading chrome left after figure-stub removal: br-only wrappers
 * anywhere, plus leading decorative `<hr>` / spacers before the first real
 * heading or paragraph so chapters do not open with a blank band.
 */
function removeEmptyReadingChrome($: cheerio.CheerioAPI): void {
  $('div.pg_body_wrapper, div.pg-body-wrapper').each((_, el) => {
    const $el = $(el) as cheerio.Cheerio<never>;
    if (isSpacerShell($el)) $el.remove();
  });

  // Second pass: any remaining br-only div/p shells (no class required).
  $('div, p').each((_, el) => {
    const $el = $(el) as cheerio.Cheerio<never>;
    if (!$el.parent().length) return;
    if (isSpacerShell($el)) $el.remove();
  });

  const children = $('body').length > 0 ? $('body').children().toArray() : $.root().children().toArray();
  for (const child of children) {
    const $child = $(child) as cheerio.Cheerio<never>;
    const tag = (((child as DomNode).tagName ?? '') as string).toLowerCase();

    if (tag === 'hr') {
      $child.remove();
      continue;
    }
    if (isSpacerShell($child) || isEmptyPlaceholder($child)) {
      $child.remove();
      continue;
    }
    // Nested title wrappers (Hoosier): keep — they have heading text.
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') break;
    if (tag === 'p' && $child.text().trim()) break;
    if ($child.find('h1, h2, h3, img').length > 0) break;
    if ($child.text().trim() && !isSpacerShell($child)) break;
    // Unknown empty-ish node at start — drop if no reading content.
    if (hasNoReadingContent($child)) {
      $child.remove();
      continue;
    }
    break;
  }
}

/** Minimal structural shape of parsed DOM nodes (domhandler-compatible). */
type DomNode = {
  type: string;
  data?: string;
  tagName?: string;
  nextSibling: DomNode | null;
};

/** True for nodes that carry no reading content (br/hr/whitespace/empty). */
function isEmptyPlaceholder($el: cheerio.Cheerio<never>): boolean {
  const el = $el.get(0) as DomNode | undefined;
  if (!el) return true;
  if (el.type === 'text') return !(el.data ?? '').trim();
  if (el.type !== 'tag') return true;
  const tag = (el.tagName ?? '').toLowerCase();
  if (tag === 'br' || tag === 'hr') return true;
  if (!$el.text().trim() && !$el.find('img').length) return true;
  return false;
}

/** True for a table-of-contents link block (class*="toc"). */
function isTocBlock($el: cheerio.Cheerio<never>): boolean {
  const cls = String($el.attr('class') ?? '').toLowerCase();
  return cls.includes('toc');
}

/**
 * Drop in-chapter contents pages: an h2/h3 whose text is exactly
 * CONTENTS / TABLE OF CONTENTS, plus the toc link blocks that follow it
 * (stopping at the first non-toc, non-empty sibling). The product ships its
 * own chapter navigation, so the duplicated page is removed.
 */
function removeContentsBlocks($: cheerio.CheerioAPI): void {
  $('h2, h3').each((_, el) => {
    const $h = $(el);
    const text = $h.text().replace(/\s+/g, ' ').trim().toLowerCase();
    if (!CONTENTS_TITLES.has(text)) return;

    const toRemove = [el];
    let node = (el as unknown as DomNode).nextSibling;
    while (node) {
      const $node = $(node as never);
      if (isEmptyPlaceholder($node)) {
        node = node.nextSibling;
        continue;
      }
      if (isTocBlock($node)) {
        toRemove.push(node as never);
        node = node.nextSibling;
        continue;
      }
      break;
    }
    for (const target of toRemove) {
      $(target).remove();
    }
  });
}

/** Inject data-p ordinals on block elements (document order). */
function injectParagraphOrdinals($: cheerio.CheerioAPI): void {
  let paragraphIndex = 0;
  const blockSelector = [...BLOCK_TAGS].join(',');
  $(blockSelector).each((_, el) => {
    const $el = $(el);
    if ($el.children().length === 0 && !$el.text().trim() && !($el.is('img') || $el.is('br') || $el.is('hr'))) {
      return;
    }
    $el.attr('data-p', String(paragraphIndex));
    paragraphIndex += 1;
  });
}

/**
 * Clean one XHTML document into normalized reading HTML.
 * `rewriteImageSrc` maps a soft-normalized local href to its final URL (e.g.
 * the proxy asset path). Returns the cleaned fragment plus collected image refs.
 */
export function cleanXhtml(html: string, rewriteImageSrc: (href: string) => string): CleanResult {
  // Document mode (not fragment): lets $('body').html() exclude the XML
  // declaration, <head> and its <title> — fragment mode returns null for
  // body.html() and the root fallback leaked head text into every chapter.
  const $ = cheerio.load(fixSelfClosingTags(html.normalize('NFC')));

  removeDangerousTags($);
  scrubAttributes($);

  const images: ChapterImageRef[] = [];
  const seenImages = new Set<string>();
  collectImages($, rewriteImageSrc, images, seenImages);
  removeNonDisplayableFigures($);
  removeEmptyReadingChrome($);

  removeContentsBlocks($);
  injectParagraphOrdinals($);

  const htmlOut = applyTextPipeline($('body').html() ?? $.root().html() ?? '');

  return { html: htmlOut.trim(), images };
}

/**
 * Drop `<img>` whose src is an unresolved ingest placeholder (zip miss).
 * `keepTokens` are placeholders that successfully resolved to package bytes.
 */
export function stripOrphanImagePlaceholders(html: string, keepTokens: ReadonlySet<string>): string {
  if (!html.includes(IMAGE_PLACEHOLDER_PREFIX)) {
    return html;
  }
  const $ = cheerio.load(html, null, false);
  $('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') ?? '';
    if (!src.includes(IMAGE_PLACEHOLDER_PREFIX)) return;
    if (keepTokens.has(src)) return;
    removeImgOrFigureShell($, $img as cheerio.Cheerio<never>);
  });
  return ($.root().html() ?? html).trim();
}
