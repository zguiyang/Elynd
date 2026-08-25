import { createHash, randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import {
  contentAsset as contentAssetTable,
  readingPart as readingPartTable,
  readingWork as readingWorkTable,
} from '@gloaming/db';

import { db } from '@/db';
import { rootLogger } from '@/lib/logger';
import { planChapters } from '@/modules/epub-ingest/chapters';
import { cleanXhtml } from '@/modules/epub-ingest/clean';
import { mimeForHref, parseEpub } from '@/modules/epub-ingest/epub';
import { cleanBookTitle, joinAuthors } from '@/modules/epub-ingest/metadata';
import { deleteObject, getObject, putObject } from '@/modules/oss';

const ingestLogger = rootLogger.child({ module: 'EpubIngest' });

const IMAGE_PLACEHOLDER_PREFIX = '__GLOAMING_IMG__';

/** max images extracted per book (abuse / runaway protection). */
const MAX_BOOK_IMAGES = 200;
const MAX_CHAPTER_HTML_CHARS = 1_500_000;

type WorkRow = typeof readingWorkTable.$inferSelect;

function imagePlaceholder(href: string): string {
  return `${IMAGE_PLACEHOLDER_PREFIX}${Buffer.from(href).toString('base64url')}__`;
}

function imageKey(workId: string, contentHash: string, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `book-images/${workId}/${contentHash}.${ext}`;
}

function coverKey(workId: string, mime: string): string {
  const ext = mime === 'image/png' ? 'png' : mime === 'image/gif' ? 'gif' : mime === 'image/webp' ? 'webp' : 'jpg';
  return `covers/${workId}.${ext}`;
}

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function loadEpubBytes(workId: string): Promise<Buffer> {
  const [asset] = await db
    .select({ storageKey: contentAssetTable.storageKey })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'origin_file')))
    .limit(1);
  if (!asset) {
    throw new Error(`Work ${workId} has no origin_file asset`);
  }
  const object = await getObject(asset.storageKey);
  if (!object) {
    throw new Error(`Origin EPUB object missing: ${asset.storageKey}`);
  }
  return object.body;
}

async function clearDerivedAssets(workId: string): Promise<void> {
  const rows = await db
    .select({ id: contentAssetTable.id, storageKey: contentAssetTable.storageKey, kind: contentAssetTable.kind })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'image')));
  const cover = await db
    .select({ id: contentAssetTable.id, storageKey: contentAssetTable.storageKey })
    .from(contentAssetTable)
    .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'cover')))
    .limit(1);

  for (const row of [...rows, ...cover]) {
    try {
      await deleteObject(row.storageKey);
    } catch (error) {
      ingestLogger.warn({ err: error, workId, storageKey: row.storageKey }, 'Failed to delete derived asset object');
    }
  }

  if (rows.length > 0) {
    await db
      .delete(contentAssetTable)
      .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'image')));
  }
  if (cover.length > 0) {
    await db
      .delete(contentAssetTable)
      .where(and(eq(contentAssetTable.workId, workId), eq(contentAssetTable.kind, 'cover')));
  }
}

/**
 * EPUB ingest job — parse, clean, chapter, store parts/images/cover, update work.
 * Idempotent: re-running replaces parts + derived assets for the work.
 */
export async function processEpubWork(workId: string): Promise<void> {
  const [work] = await db.select().from(readingWorkTable).where(eq(readingWorkTable.id, workId)).limit(1);
  if (!work) {
    throw new Error(`Work ${workId} not found`);
  }

  try {
    const epubBytes = await loadEpubBytes(workId);
    const book = await parseEpub(epubBytes);

    // Clean each spine chapter; image srcs are placeholder-tokenized and
    // rewritten after assets are stored.
    const placeholderToHref = new Map<string, string>();
    const chapters = planChapters(book, (href, rawHtml) => {
      const cleaned = cleanXhtml(rawHtml, (src) => {
        const token = imagePlaceholder(src);
        if (!placeholderToHref.has(token)) {
          placeholderToHref.set(token, src);
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

    await clearDerivedAssets(workId);

    // Store images → content_asset rows → final src URLs.
    const hrefToAssetId = new Map<string, string>();
    let storedImages = 0;
    for (const token of placeholderToHref.keys()) {
      if (storedImages >= MAX_BOOK_IMAGES) break;
      const href = placeholderToHref.get(token)!;
      const bytes = book.entries.get(href);
      if (!bytes) continue;
      const mime = mimeForHref(href);
      const hash = sha256(bytes);
      const key = imageKey(workId, hash, mime);
      await putObject({ key, body: bytes, contentType: mime });
      const assetId = randomUUID();
      await db.insert(contentAssetTable).values({
        id: assetId,
        workId,
        kind: 'image',
        storageKey: key,
        mimeType: mime,
        contentHash: hash,
        meta: { originalPath: href, size: bytes.length },
        status: 'ready',
      });
      hrefToAssetId.set(href, assetId);
      storedImages += 1;
    }

    const rewriteSrc = (html: string): string => {
      let out = html;
      for (const token of placeholderToHref.keys()) {
        const href = placeholderToHref.get(token)!;
        const assetId = hrefToAssetId.get(href);
        if (assetId) {
          out = out.split(token).join(`/api/reader/assets/${assetId}`);
        } else {
          out = out.split(token).join('');
        }
      }
      return out;
    };

    // Cover asset.
    let coverAssetId: string | null = null;
    if (book.coverHref) {
      const coverBytes = book.entries.get(book.coverHref);
      if (coverBytes) {
        const mime = mimeForHref(book.coverHref);
        const key = coverKey(workId, mime);
        await putObject({ key, body: coverBytes, contentType: mime });
        const assetId = randomUUID();
        await db.insert(contentAssetTable).values({
          id: assetId,
          workId,
          kind: 'cover',
          storageKey: key,
          mimeType: mime,
          contentHash: sha256(coverBytes),
          meta: { originalPath: book.coverHref, size: coverBytes.length },
          status: 'ready',
        });
        coverAssetId = assetId;
      }
    }

    // Replace parts (idempotent re-parse).
    await db.delete(readingPartTable).where(eq(readingPartTable.workId, workId));
    for (let i = 0; i < chapters.length; i += 1) {
      const chapter = chapters[i]!;
      await db.insert(readingPartTable).values({
        id: randomUUID(),
        workId,
        sortOrder: i,
        kind: 'chapter',
        title: chapter.title.slice(0, 200),
        body: rewriteSrc(chapter.html),
      });
    }

    // Metadata: first parse fills from the book; re-parse keeps hand-edited
    // values (admin may have corrected title/author/description) and only
    // fills empty fields.
    const hasParsedBefore = Boolean(work.originMeta?.parsed);
    const parsedTitle = cleanBookTitle(book.title);
    const title = hasParsedBefore ? work.title || parsedTitle || work.title : parsedTitle || work.title;
    const author = hasParsedBefore ? work.author || joinAuthors(book.authors) : joinAuthors(book.authors);
    const description = hasParsedBefore ? work.description || book.description || '' : book.description || '';

    await db
      .update(readingWorkTable)
      .set({
        title,
        author,
        description,
        language: book.language,
        coverAssetId,
        status: 'draft',
        publishedAt: null,
        originMeta: {
          ...work.originMeta,
          parsed: {
            opfTitle: book.title,
            authors: book.authors,
            description: book.description,
            language: book.language,
            coverHref: book.coverHref,
            spineCount: book.spine.length,
            navCount: book.nav.length,
            chapterCount: chapters.length,
            imageCount: storedImages,
            parsedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(readingWorkTable.id, workId));

    ingestLogger.info({ workId, title, chapters: chapters.length, images: storedImages }, 'EPUB ingest complete');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ingestLogger.error({ err: error, workId }, 'EPUB ingest failed');
    await db
      .update(readingWorkTable)
      .set({
        status: 'failed',
        originMeta: { ...work.originMeta, lastError: message, failedAt: new Date().toISOString() },
      })
      .where(eq(readingWorkTable.id, workId));
    throw error;
  }
}

export type { WorkRow as EpubWorkRow };
