import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { AppError } from '../errors/AppError';
import { ensureTempDir } from './temp';

export interface DownloadResult {
  fileName: string;
  tempPath?: string;
  size: number;
  downloadedAt: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const INVALID_FILENAME_CHARS = /[\\/:*?"<>]/g;

function sanitizeFileStem(stem: string): string {
  const cleaned = stem.replace(INVALID_FILENAME_CHARS, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'song';
}

function parseHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(400, 'Invalid URL');
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new AppError(400, `Unsupported protocol: ${parsed.protocol}`);
  }
  return parsed;
}

const IMAGE_EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function getImageExtFromUrl(url: string): string {
  try {
    return path.extname(new URL(url).pathname).toLowerCase() || '';
  } catch {
    return '';
  }
}

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/flac': '.flac',
  'audio/x-flac': '.flac',
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/m4a': '.m4a',
  'audio/ogg': '.ogg',
  'audio/opus': '.opus',
};

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return path.extname(pathname) || '';
  } catch {
    return '';
  }
}

function getExtensionFromContentType(contentType: string): string {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return EXT_BY_CONTENT_TYPE[mime] ?? '';
}

export async function downloadSong(
  url: string,
  destDir: string,
  fileStem: string,
): Promise<DownloadResult> {
  parseHttpUrl(url);

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new AppError(502, `Failed to download song: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new AppError(502, 'Failed to download song: empty response body');
  }

  await mkdir(destDir, { recursive: true });

  const urlExt = getExtensionFromUrl(url);
  const contentType = response.headers.get('content-type') ?? '';
  const ext = urlExt || getExtensionFromContentType(contentType) || '.mp3';
  const fileName = `${sanitizeFileStem(fileStem)}${ext}`;
  const tempDir = await ensureTempDir('downloads');
  const tempPath = path.join(tempDir, `.${fileName}.${randomUUID()}.part${ext}`);

  const writeStream = createWriteStream(tempPath);
  await pipeline(response.body, writeStream);

  return {
    fileName,
    tempPath,
    size: Number(response.headers.get('content-length') ?? 0),
    downloadedAt: new Date().toISOString(),
  };
}

export async function downloadImage(
  url: string,
  destDir: string,
  fileName: string,
): Promise<DownloadResult> {
  parseHttpUrl(url);

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new AppError(502, `Failed to download image: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new AppError(502, 'Failed to download image: empty response body');
  }

  await mkdir(destDir, { recursive: true });

  const urlExt = getImageExtFromUrl(url);
  const contentType = response.headers.get('content-type') ?? '';
  const mimeExt = IMAGE_EXT_BY_CONTENT_TYPE[contentType.split(';')[0].trim().toLowerCase()] ?? '';
  const ext = urlExt || mimeExt || '.jpg';
  const finalName = `${fileName}${ext}`;
  const filePath = path.join(destDir, finalName);

  const writeStream = createWriteStream(filePath);
  await pipeline(response.body, writeStream);

  return {
    fileName: finalName,
    tempPath: filePath,
    size: Number(response.headers.get('content-length') ?? 0),
    downloadedAt: new Date().toISOString(),
  };
}
