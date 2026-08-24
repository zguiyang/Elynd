import { createHash } from 'node:crypto';

import { HTTP_STATUS } from '@/constants';
import { AppError } from '@/lib/errors';
import { putObject } from '@/modules/oss';

/**
 * Generic object upload capability. Callers (works EPUB, future avatars) supply
 * a spec (allowed extensions / MIME types / size cap / content check) plus the
 * object key — this service validates and stores, nothing more.
 */

export type UploadSpec = {
  /** Lower-case file extensions without dot, e.g. ['epub']. */
  allowedExtensions: string[];
  /** Case-insensitive MIME whitelist. Empty string (browser unknown type) is always allowed. */
  allowedMimeTypes: string[];
  maxBytes: number;
  /** Optional content-level check — returns an error message when invalid. */
  validateContent?: (body: Buffer) => string | null;
};

export type UploadedFileMeta = {
  storageKey: string;
  mimeType: string;
  contentHash: string;
  size: number;
};

export function fileExtension(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : '';
}

export function hashFileContent(body: Buffer): string {
  return createHash('sha256').update(body).digest('hex');
}

/** ZIP magic bytes — EPUB files are zip archives. */
export function isZipFile(body: Buffer): boolean {
  return body.length >= 4 && body[0] === 0x50 && body[1] === 0x4b && body[2] === 0x03 && body[3] === 0x04;
}

export async function uploadObjectFile(input: {
  key: string;
  fileName: string;
  body: Buffer;
  contentType: string;
  spec: UploadSpec;
}): Promise<UploadedFileMeta> {
  const { key, fileName, body, contentType, spec } = input;

  const extension = fileExtension(fileName);
  if (!extension || !spec.allowedExtensions.includes(extension)) {
    const labels = spec.allowedExtensions.map((ext) => `.${ext}`).join(' / ');
    throw new AppError(HTTP_STATUS.BAD_REQUEST, `仅支持 ${labels} 格式文件`);
  }

  const normalizedType = contentType.trim().toLowerCase();
  if (normalizedType && !spec.allowedMimeTypes.includes(normalizedType)) {
    throw new AppError(HTTP_STATUS.BAD_REQUEST, '文件类型不受支持');
  }

  if (body.length > spec.maxBytes) {
    const mb = Math.floor(spec.maxBytes / (1024 * 1024));
    throw new AppError(HTTP_STATUS.BAD_REQUEST, `文件大小超过上限（${mb}MB）`);
  }

  if (spec.validateContent) {
    const message = spec.validateContent(body);
    if (message) {
      throw new AppError(HTTP_STATUS.BAD_REQUEST, message);
    }
  }

  await putObject({ key, body, contentType: normalizedType || 'application/octet-stream' });

  return {
    storageKey: key,
    mimeType: normalizedType || 'application/octet-stream',
    contentHash: hashFileContent(body),
    size: body.length,
  };
}
