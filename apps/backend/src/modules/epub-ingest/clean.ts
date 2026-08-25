import * as cheerio from 'cheerio';

import { normalizeEpubHref } from './epub';
import type { ChapterImageRef } from './types';

/**
 * XHTML → normalized reading HTML.
 *
 * Output contract (the "fixed output" for every content source):
 * - Allowed tags: p h1-h3 img em strong ul ol li blockquote hr br sup sub
 *   ruby rt a (href kept) — everything else is unwrapped (children survive).
 * - Dropped: script style link iframe object embed base form input button
 *   nav header footer meta noscript; all on* attributes; dangerous URL
 *   schemes (javascript:/vbscript:/file:/blob:); non-image data: URLs.
 * - Block-level elements get `data-p="N"` ordinal attributes so the Reader
 *   can anchor selections to paragraphs (replaces client-side paragraph ids).
 * - img[src] must be a local relative path (rewritten later by the ingest
 *   service); external http(s) URLs and non-image data: URLs are removed.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'img',
  'em',
  'strong',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'br',
  'sup',
  'sub',
  'ruby',
  'rt',
  'a',
]);

/** Tags whose text content is dropped entirely. */
const DROP_TAGS = new Set([
  'script',
  'style',
  'link',
  'iframe',
  'object',
  'embed',
  'base',
  'form',
  'input',
  'button',
  'nav',
  'header',
  'footer',
  'meta',
  'noscript',
  'template',
  'svg',
]);

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

const URL_ATTRS = ['href', 'src', 'srcset', 'action', 'formaction', 'xlink:href'];

const DANGEROUS_SCHEME = /^(javascript|vbscript|file|blob):/i;
const DATA_IMAGE_OK = /^data:image\/(?!svg)[^;,]+[,;]/i;

function isSafeUrlValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (DANGEROUS_SCHEME.test(trimmed)) return false;
  if (trimmed.toLowerCase().startsWith('data:')) {
    return DATA_IMAGE_OK.test(trimmed);
  }
  return true;
}

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

/**
 * Clean one XHTML document into normalized reading HTML.
 * `rewriteImageSrc` maps a normalized local href to its final URL (e.g. the
 * proxy asset path). Returns the cleaned fragment plus collected image refs.
 */
export function cleanXhtml(html: string, rewriteImageSrc: (href: string) => string): CleanResult {
  const $ = cheerio.load(html, null, false);
  const images: ChapterImageRef[] = [];
  const seenImages = new Set<string>();

  $('*').each((_, el) => {
    if (el.type !== 'tag' && el.type !== 'script' && el.type !== 'style') return;
    const tagEl = el as unknown as { tagName: string; attribs: Record<string, string> };
    const $el = $(el);
    const tag = tagEl.tagName.toLowerCase();
    if (!tag) return;

    if (DROP_TAGS.has(tag)) {
      $el.remove();
      return;
    }

    // Remove unsafe attributes.
    for (const attr of Object.keys(tagEl.attribs ?? {})) {
      const name = attr.toLowerCase();
      if (name.startsWith('on')) {
        $el.removeAttr(attr);
        continue;
      }
      if (URL_ATTRS.includes(name)) {
        const value = $el.attr(attr) ?? '';
        if (!isSafeUrlValue(value)) {
          $el.removeAttr(attr);
        }
      }
    }
  });

  // Rewrite / collect images, drop external or data images.
  $('img').each((_, el) => {
    const $img = $(el);
    const src = $img.attr('src') ?? '';
    if (!isLocalImageHref(src)) {
      $img.remove();
      return;
    }
    const normalized = normalizeEpubHref(src);
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
    $img.removeAttr('srcset');
  });

  // Unwrap everything outside the allowed tag set (children survive).
  $('*').each((_, el) => {
    if (el.type !== 'tag' && el.type !== 'script' && el.type !== 'style') return;
    const tagEl = el as unknown as { tagName: string };
    const $el = $(el);
    const tag = tagEl.tagName.toLowerCase();
    if (!tag || tag === 'html' || tag === 'body' || ALLOWED_TAGS.has(tag)) return;
    $el.replaceWith($el.contents());
  });

  // Inject data-p ordinals on block elements (document order).
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

  const htmlOut = $('body').html() ?? $.root().html() ?? '';

  return { html: htmlOut.trim(), images };
}
