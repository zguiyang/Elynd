import { registerParser } from '@/modules/content-parser/registry';
import type { ContentParser, ParsedContent } from '@/modules/content-parser/types';
import { planChapters } from '@/modules/epub-ingest/chapters';
import { cleanXhtml } from '@/modules/epub-ingest/clean';
import { mimeForHref, parseEpub, resolveEpubHref } from '@/modules/epub-ingest/epub';

const IMAGE_PLACEHOLDER_PREFIX = '__GLOAMING_IMG__';

/** Max HTML chars per chapter (abuse / runaway protection). */
const MAX_CHAPTER_HTML_CHARS = 1_500_000;

function imagePlaceholder(href: string): string {
  return `${IMAGE_PLACEHOLDER_PREFIX}${Buffer.from(href).toString('base64url')}__`;
}

/**
 * EPUB content parser — container parse → clean → chapter plan → unified
 * {@link ParsedContent}. Chapter HTML carries placeholder tokens for local
 * images; the orchestrator stores the bytes and rewrites the URLs.
 */
export const epubContentParser: ContentParser = {
  kind: 'admin_epub',

  async parse(bytes: Buffer): Promise<ParsedContent> {
    const book = await parseEpub(bytes);

    // Spine/image hrefs are relative to the OPF directory — resolve before
    // matching zip entries (without it every img src lookup misses and images
    // are silently dropped, leaving empty src attributes).
    const opfDir = book.opfPath.includes('/') ? book.opfPath.slice(0, book.opfPath.lastIndexOf('/')) : '';

    const placeholderToHref = new Map<string, string>();
    const chapters = planChapters(book, (href, rawHtml) => {
      const cleaned = cleanXhtml(rawHtml, (src) => {
        const token = imagePlaceholder(src);
        if (!placeholderToHref.has(token)) {
          placeholderToHref.set(token, resolveEpubHref(opfDir, src));
        }
        return token;
      });
      if (cleaned.html.length > MAX_CHAPTER_HTML_CHARS) {
        throw new Error(`Chapter from ${href} exceeds ${MAX_CHAPTER_HTML_CHARS} chars`);
      }
      return { title: '', html: cleaned.html, images: cleaned.images };
    });

    if (chapters.length === 0) {
      throw new Error('EPUB produced no readable chapters');
    }

    const images: ParsedContent['images'] = [];
    for (const [token, href] of placeholderToHref) {
      const imageBytes = book.entries.get(href);
      if (!imageBytes) continue;
      images.push({ token, href, mime: mimeForHref(href), bytes: imageBytes });
    }

    let cover: ParsedContent['cover'] = null;
    if (book.coverHref) {
      const coverBytes = book.entries.get(book.coverHref);
      if (coverBytes) {
        cover = { bytes: coverBytes, mime: mimeForHref(book.coverHref), originalPath: book.coverHref };
      }
    }

    return {
      metadata: {
        title: book.title,
        authors: book.authors,
        description: book.description,
        language: book.language,
        subjects: book.subjects,
        sourceRaw: book.sourceRaw,
      },
      chapters: chapters.map((chapter) => ({ title: chapter.title, html: chapter.html })),
      images,
      cover,
      stats: {
        spineCount: book.spine.length,
        navCount: book.nav.length,
        chapterCount: chapters.length,
      },
    };
  },
};

registerParser(epubContentParser);
