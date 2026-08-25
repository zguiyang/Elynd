import * as cheerio from 'cheerio';

import type { CleanedChapter, EpubBook, EpubNavItem } from './types';

/**
 * Chaptering — port of textstack's rules:
 * 1. nav/NCX title map wins; visible h1/h2/h3 fallback (never <head><title>).
 * 2. Single-file EPUBs split on h2/h3 headings that look like chapter markers.
 * 3. Untitled spine files merge into the previous chapter.
 * 4. Bare chapter-number stubs ("<h1>10</h1>") merge with the following body,
 *    keeping the nav-derived title.
 * 5. Front/back matter that has no reading value is dropped:
 *    titlepage, cover, copyright, imprint, contents, dedication,
 *    acknowledgments, about the author, colophon, index, notes/endnotes.
 *    Prefaces / forewords / introductions / afterwords / epilogues / appendices
 *    are kept as regular chapters.
 */

export type SplitChapter = {
  title: string | null;
  html: string;
};

const MAX_HEADING_TITLE_CHARS = 100;

const FRONT_MATTER_PATTERN = new RegExp(
  String.raw`^(title\s*page|cover|copyright|imprint|contents?|table\s+of\s+contents|dedication|acknowledg?ments?|about\s+the\s+author|colophon|index|notes?|endnotes?)$`,
  'i',
);

const KEEP_MATTER_PATTERN = new RegExp(
  String.raw`^(preface|foreword|introduction|afterword|epilogue|appendix|appendices)$`,
  'i',
);

const CHAPTER_HEADING_PATTERN = new RegExp(
  String.raw`^(chapter|ch\.?|part|book|section|lesson|unit|story|глава|часть)\b`,
  'i',
);

const ROMAN_NUMERAL = /^(?:M{0,4})(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})$/i;
const NUMBER_WORD =
  /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)$/i;

/** True when a nav entry's label names a front/back matter page to drop. */
export function isDropFrontMatterLabel(label: string): boolean {
  return FRONT_MATTER_PATTERN.test(label.trim());
}

function isKeepMatterLabel(label: string): boolean {
  return KEEP_MATTER_PATTERN.test(label.trim());
}

function isChapterLikeHeading(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > MAX_HEADING_TITLE_CHARS) return false;
  if (CHAPTER_HEADING_PATTERN.test(trimmed)) return true;
  if (ROMAN_NUMERAL.test(trimmed)) return true;
  if (/^\d{1,3}$/.test(trimmed)) return true;
  if (NUMBER_WORD.test(trimmed)) return true;
  return false;
}

function isHeadingNumberStub(html: string): boolean {
  const $ = cheerio.load(html, null, false);
  const h1 = $('h1').first().text().trim();
  if (!h1 || h1.length > 30) return false;
  const wordCount = $.root().text().trim().split(/\s+/).filter(Boolean).length;
  return wordCount <= 5 && /^\d{1,3}$|^[IVXLCDM]+$/i.test(h1);
}

function buildNavTitleMap(nav: EpubNavItem[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of nav) {
    const existing = map.get(item.href);
    if (!existing || item.depth <= 2) {
      map.set(item.href, item.label.trim());
    }
  }
  return map;
}

function firstVisibleHeadingTitle(html: string): string | null {
  const $ = cheerio.load(html, null, false);
  for (const tag of ['h1', 'h2', 'h3']) {
    const $h = $(tag).first();
    if ($h.length === 0) continue;
    const title = $h.text().replace(/\s+/g, ' ').trim();
    if (title && title.length <= MAX_HEADING_TITLE_CHARS) return title;
  }
  return null;
}

function detectMatterType(title: string): string | null {
  const trimmed = title.trim().toLowerCase();
  if (isDropFrontMatterLabel(trimmed)) return 'drop';
  if (isKeepMatterLabel(trimmed)) return 'keep';
  return null;
}

/**
 * Split a single-file EPUB by h2/h3 headings that look like chapter markers.
 * Returns one section per heading (+ trailing content); empty result when the
 * document has no split-worthy headings.
 */
export function splitSingleFileByHeadings(html: string): SplitChapter[] {
  const $ = cheerio.load(html, null, false);
  const headings = $('h2, h3')
    .toArray()
    .map((el) => ({
      el,
      title: $(el).text().replace(/\s+/g, ' ').trim(),
    }))
    .filter((h) => isChapterLikeHeading(h.title));

  if (headings.length < 2) return [];

  const sections: SplitChapter[] = [];
  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i]!;
    const end = headings[i + 1]?.el ?? null;
    // Fragment mode strips html/body — headings may be direct root children.
    const parent = ($(start.el).parent().length > 0
      ? $(start.el).parent()
      : $.root()) as unknown as cheerio.Cheerio<never>;

    const htmlBuf: string[] = [];
    let started = false;
    for (const child of parent.children().toArray()) {
      if (child === start.el) {
        started = true;
      }
      if (!started) continue;
      if (end && child === end) {
        break;
      }
      htmlBuf.push($.html(child));
    }

    const sectionHtml = htmlBuf.join('').trim();
    if (sectionHtml) {
      sections.push({ title: start.title ?? '', html: sectionHtml });
    }
  }
  return sections;
}

export type ChapterPlan = {
  title: string;
  html: string;
};

/**
 * Build the ordered chapter plan from spine files + cleaned HTML + nav.
 * `clean` transforms raw XHTML into { html, images }.
 */
export function planChapters(book: EpubBook, clean: (href: string, rawHtml: string) => CleanedChapter): ChapterPlan[] {
  const navTitleMap = buildNavTitleMap(book.nav);
  const chapters: ChapterPlan[] = [];
  let previous: ChapterPlan | null = null;
  let previousIndex = -1;

  // Single-file EPUB: try heading split first.
  if (book.spine.length === 1) {
    const href = book.spine[0]!.href;
    const raw = book.entries.get(href);
    if (raw) {
      const sections = splitSingleFileByHeadings(raw.toString('utf8'));
      if (sections.length > 0) {
        for (const section of sections) {
          const cleaned = clean(href, section.html);
          if (!cleaned.html.trim()) continue;
          chapters.push({ title: section.title ?? '', html: cleaned.html });
        }
        return chapters;
      }
    }
  }

  for (const spineItem of book.spine) {
    const raw = book.entries.get(spineItem.href);
    if (!raw) continue;
    const rawHtml = raw.toString('utf8');
    const cleaned = clean(spineItem.href, rawHtml);
    const html = cleaned.html;
    if (!html.trim()) continue;

    const navTitle = navTitleMap.get(spineItem.href) ?? null;
    const headingTitle = firstVisibleHeadingTitle(html);
    const candidateTitle = navTitle ?? headingTitle ?? null;

    // Drop front/back matter with no reading value (unless it's keep-matter).
    if (candidateTitle) {
      const matter = detectMatterType(candidateTitle);
      if (matter === 'drop') continue;
    } else if (!headingTitle && !navTitle) {
      // Untitled file → merge into previous chapter.
      if (previous) {
        previous.html = `${previous.html}\n${html}`;
        continue;
      }
    }

    // Bare chapter-number stub as previous chapter → merge body in, keep title.
    if (previous && isHeadingNumberStub(previous.html) && candidateTitle) {
      previous.html = `${previous.html}\n${html}`;
      continue;
    }

    let title: string;
    if (candidateTitle) {
      title = candidateTitle;
    } else {
      title = `Section ${chapters.length + 1}`;
    }

    const chapter: ChapterPlan = { title, html };
    chapters.push(chapter);
    previous = chapter;
    previousIndex = chapters.length - 1;
    void previousIndex;
  }

  return chapters;
}
