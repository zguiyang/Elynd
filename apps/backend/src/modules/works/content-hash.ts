import { createHash } from 'node:crypto';

/** Normalize title+body so source hash is stable across trivial whitespace churn. */
export function normalizePartContent(title: string, body: string): string {
  const normalizedTitle = title.replace(/\s+/g, ' ').trim();
  const normalizedBody = body
    .replace(/\r\n/g, '\n')
    .split(/\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${normalizedTitle}\n\n${normalizedBody}`;
}

/** SSOT source-content hash for derived projections (audio, translate cache). */
export function hashPartContent(title: string, body: string): string {
  return createHash('sha256').update(normalizePartContent(title, body), 'utf8').digest('hex');
}
