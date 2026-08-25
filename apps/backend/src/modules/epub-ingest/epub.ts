/* eslint-disable @typescript-eslint/naming-convention -- fast-xml-parser attribute keys (@_*) are non-negotiable */
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { fromBuffer as yauzlFromBuffer } from 'yauzl';

import { rootLogger } from '@/lib/logger';

import type { EpubBook, EpubNavItem } from './types';

const epubLogger = rootLogger.child({ module: 'EpubIngest' });

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

function normalizeHref(href: string): string {
  let result = href.trim();
  while (result.startsWith('../')) result = result.slice(3);
  while (result.startsWith('./')) result = result.slice(2);
  result = result.replace(/^\/+/, '');
  return result.split('#')[0]!.trim();
}

/** Resolve a manifest href relative to the OPF directory. */
function resolveHref(opfDir: string, href: string): string {
  const normalized = normalizeHref(href);
  if (!opfDir || normalized.startsWith(opfDir + '/') || !normalized) return normalized;
  return normalizeHref(`${opfDir}/${normalized}`);
}

function decodePath(entry: string): string {
  try {
    return decodeURIComponent(entry);
  } catch {
    return entry;
  }
}

/** Read every zip entry into memory (EPUBs are capped at 50MB on upload). */
function readZipEntries(buffer: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    yauzlFromBuffer(buffer, { lazyEntries: true }, (err, zip) => {
      if (err) {
        reject(new Error(`EPUB is not a valid zip: ${err.message}`));
        return;
      }
      if (!zip) {
        reject(new Error('EPUB zip could not be opened'));
        return;
      }

      const entries = new Map<string, Buffer>();
      const normalized = new Map<string, string>();

      zip.on('error', (readErr) => reject(readErr));
      zip.on('end', () => resolve(entries));
      zip.on('entry', (entry) => {
        const name = decodePath(entry.fileName);
        const key = normalizeHref(name);
        zip.openReadStream(entry, (openErr, stream) => {
          if (openErr) {
            reject(openErr);
            return;
          }
          if (!stream) {
            reject(new Error(`No read stream for zip entry: ${name}`));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            const existing = normalized.get(key);
            if (!existing || existing.length < name.length) {
              normalized.set(key, name);
            }
            entries.set(key, Buffer.concat(chunks));
            zip.readEntry();
          });
          stream.on('error', (streamErr) => reject(streamErr));
        });
      });

      zip.readEntry();
    });
  });
}

/** Minimal XML helpers with fast-xml-parser (attributes prefixed `@_`). */
function parseXml(xml: string): unknown {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
    isArray: (name) => name === 'item' || name === 'itemref' || name === 'navPoint' || name === 'dc:creator',
  });
  return parser.parse(xml);
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '#text' in value && typeof value['#text'] === 'string') {
    return value['#text'];
  }
  return '';
}

function findEntry(entries: Map<string, Buffer>, name: string): Buffer | undefined {
  const direct = entries.get(name);
  if (direct) return direct;
  const key = normalizeHref(name);
  return entries.get(key);
}

function findEntryCaseInsensitive(entries: Map<string, Buffer>, name: string): Buffer | undefined {
  const direct = findEntry(entries, name);
  if (direct) return direct;
  const lower = normalizeHref(name).toLowerCase();
  for (const [key] of entries) {
    if (key.toLowerCase() === lower) return entries.get(key);
  }
  return undefined;
}

function rootfilePath(containerXml: Buffer): string | null {
  const doc = parseXml(containerXml.toString('utf8')) as { container?: { rootfiles?: unknown } };
  const rootfiles = doc.container?.rootfiles as { rootfile?: unknown } | undefined;
  let rootfile = rootfiles?.rootfile;
  if (Array.isArray(rootfile)) rootfile = rootfile[0];
  const href = (rootfile as { '@_full-path'?: string } | undefined)?.['@_full-path'];
  return href ? normalizeHref(href) : null;
}

function manifestItems(opf: Record<string, unknown>): Array<{
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}> {
  const manifest = opf.manifest as { item?: unknown } | undefined;
  const items = manifest?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  return list.map((item) => {
    const row = item as Record<string, string>;
    return {
      id: row['@_id'] ?? '',
      href: normalizeHref(row['@_href'] ?? ''),
      mediaType: row['@_media-type'] ?? '',
      properties: row['@_properties'],
    };
  });
}

function spineItems(opf: Record<string, unknown>): Array<{ href: string; idref: string }> {
  const spine = opf.spine as { itemref?: unknown } | undefined;
  const refs = spine?.itemref;
  const list = Array.isArray(refs) ? refs : refs ? [refs] : [];
  return list.map((ref) => ({
    href: '',
    idref: (ref as { '@_idref'?: string })['@_idref'] ?? '',
  }));
}

function parseNavTree(navItems: unknown, depth = 1): EpubNavItem[] {
  const out: EpubNavItem[] = [];
  const items = Array.isArray(navItems) ? navItems : navItems ? [navItems] : [];
  for (const item of items) {
    const row = item as { label?: unknown; content?: unknown; navPoint?: unknown };
    const label = row.label as { text?: unknown } | undefined;
    const text = label?.text;
    const title = typeof text === 'string' ? text : textOf(text);
    const content = row.content as { '@_src'?: string } | undefined;
    const src = content?.['@_src'] ?? '';
    const [href, fragment] = src.split('#');
    const normalized = normalizeHref(href);
    if (title && normalized) {
      out.push({ label: title, href: normalized, fragment, depth });
    }
    out.push(...parseNavTree(row.navPoint, depth + 1));
  }
  return out;
}

function parseNavDocument(html: string): EpubNavItem[] {
  const $ = cheerio.load(html);
  const toc = $('nav[epub\\:type="toc"]').first();
  if (toc.length === 0) return [];
  const out: EpubNavItem[] = [];
  const walk = (ol: ReturnType<cheerio.CheerioAPI>, depth: number): void => {
    ol.children('li').each((_, li) => {
      const $li = $(li);
      const $a = $li.children('a').first();
      const label = $a.text().trim();
      const href = $a.attr('href') ?? '';
      const [path, fragment] = href.split('#');
      const normalized = normalizeHref(path);
      if (label && normalized) {
        out.push({ label, href: normalized, fragment, depth });
      }
      const nested = $li.children('ol').first();
      if (nested.length > 0) walk(nested, depth + 1);
    });
  };
  walk(toc.children('ol').first(), 1);
  return out;
}

/**
 * Parse an EPUB byte buffer into the container model:
 * entries, OPF metadata, spine, navigation (nav.xhtml → NCX), cover href.
 */
export async function parseEpub(buffer: Buffer): Promise<EpubBook> {
  const entries = await readZipEntries(buffer);
  const container = findEntryCaseInsensitive(entries, 'META-INF/container.xml');
  if (!container) {
    throw new Error('EPUB is missing META-INF/container.xml');
  }

  const opfPath = rootfilePath(container);
  if (!opfPath) {
    throw new Error('EPUB container.xml has no OPF rootfile');
  }

  const opfXml = findEntryCaseInsensitive(entries, opfPath);
  if (!opfXml) {
    throw new Error(`EPUB OPF not found: ${opfPath}`);
  }

  const opf = parseXml(opfXml.toString('utf8')) as { package?: Record<string, unknown> };
  const pkg = (opf.package ?? opf) as Record<string, unknown>;
  const metadata = (pkg.metadata ?? {}) as Record<string, unknown>;

  const title =
    textOf((metadata['dc:title'] as unknown) ?? '') ||
    textOf(Array.isArray(metadata['dc:title']) ? (metadata['dc:title'] as unknown[])[0] : metadata['dc:title']) ||
    '';

  const creators = metadata['dc:creator'];
  const creatorList = Array.isArray(creators)
    ? creators.map((c) => textOf(c as unknown))
    : creators
      ? [textOf(creators as unknown)]
      : [];
  const authors = creatorList.map((a) => a.trim()).filter(Boolean);

  const languageRaw = textOf(metadata['dc:language'] as unknown);
  const language = normalizeLanguage(languageRaw);

  const description = textOf(metadata['dc:description'] as unknown);

  // Manifest hrefs are relative to the OPF directory (e.g. "chapter-1.xhtml"
  // lives at "OEBPS/chapter-1.xhtml"); resolve before matching zip entries.
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
  const resolve = (href: string): string => resolveHref(opfDir, href);

  const manifest = manifestItems(pkg).map((item) => ({ ...item, href: resolve(item.href) }));
  const idToHref = new Map(manifest.map((item) => [item.id, item.href]));
  const spine = spineItems(pkg)
    .map((item) => ({ href: idToHref.get(item.idref) ?? '', idref: item.idref }))
    .filter((item) => Boolean(item.href));

  if (spine.length === 0) {
    throw new Error('EPUB has an empty spine (no reading content)');
  }

  // Navigation: EPUB3 nav document first, EPUB2 NCX fallback.
  const navItem = manifest.find((item) => item.properties?.split(/\s+/).includes('nav'));
  let nav: EpubNavItem[] = [];
  if (navItem) {
    const navHtml = findEntryCaseInsensitive(entries, navItem.href);
    if (navHtml) {
      nav = parseNavDocument(navHtml.toString('utf8')).map((item) => ({
        ...item,
        href: resolve(item.href),
      }));
    }
  }
  if (nav.length === 0) {
    const spineToc = (pkg.spine as { '@_toc'?: string } | undefined)?.['@_toc'];
    const ncxHref = spineToc ? idToHref.get(spineToc) : null;
    const ncxEntry =
      (ncxHref && findEntryCaseInsensitive(entries, ncxHref)) ||
      findEntryCaseInsensitive(entries, 'toc.ncx') ||
      [...entries.entries()].find(([key]) => key.toLowerCase().endsWith('.ncx'))?.[1];
    if (ncxEntry) {
      const ncx = parseXml(ncxEntry.toString('utf8')) as { ncx?: { navMap?: unknown } };
      nav = parseNavTree(ncx.ncx?.navMap);
    }
  }

  const coverHref = resolveCoverHref(pkg, manifest, entries);

  epubLogger.info(
    { title, authors: authors.join(', '), spineCount: spine.length, navCount: nav.length, coverHref },
    'EPUB parsed',
  );

  return {
    entries,
    opfPath,
    title,
    authors,
    description,
    language,
    spine,
    nav,
    coverHref,
    coverMime: coverHref ? mimeForHref(coverHref) : null,
  };
}

export function normalizeLanguage(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!value) return 'en';
  const match = /^([a-z]{2,3})(?:[-_])/.exec(value);
  return match ? match[1]! : value.slice(0, 2);
}

export function mimeForHref(href: string): string {
  const ext = href.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext ? (IMAGE_MIME_BY_EXT[`.${ext}`] ?? 'application/octet-stream') : 'application/octet-stream';
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}

function resolveCoverHref(
  pkg: Record<string, unknown>,
  manifest: Array<{ id: string; href: string; mediaType: string; properties?: string }>,
  entries: Map<string, Buffer>,
): string | null {
  // EPUB3: properties="cover-image".
  const epub3 = manifest.find((item) => item.properties?.split(/\s+/).includes('cover-image'));
  if (epub3) return epub3.href;

  // EPUB2: <meta name="cover" content="item-id"/>.
  const metas = pkg.metadata as { meta?: unknown } | undefined;
  const metaList = Array.isArray(metas?.meta) ? metas!.meta : metas?.meta ? [metas.meta] : [];
  for (const meta of metaList as Array<Record<string, string>>) {
    if (String(meta['@_name'] ?? '').toLowerCase() === 'cover') {
      const id = meta['@_content'];
      const item = manifest.find((m) => m.id === id);
      if (item) return item.href;
    }
  }

  // Heuristic: entry name contains cover/couv (raster only, mirroring foliate).
  const candidates = [...entries.keys()].filter(
    (key) => /cover|couv/i.test(key) && !key.toLowerCase().endsWith('.svg'),
  );
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.length - b.length);
    return candidates[0]!;
  }
  return null;
}

export { findEntryCaseInsensitive as findEpubEntry, normalizeHref as normalizeEpubHref };
