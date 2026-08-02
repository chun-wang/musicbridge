import { execFile } from 'node:child_process';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env';
import { logger } from '../config/logger';

const execFileAsync = promisify(execFile);

export interface SongMetadata {
  title?: string;
  artist?: string;
  album?: string;
  lyrics?: string;
  coverPath?: string;
}

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3',
  '.flac',
  '.m4a',
  '.mp4',
  '.aac',
  '.ogg',
  '.opus',
  '.wav',
]);

function getTempPath(src: string): string {
  const ext = path.extname(src);
  const basename = path.basename(src).slice(0, -ext.length);
  return path.join(path.dirname(src), `${basename}.ffmetadata${ext}`);
}

export async function embedMetadata(filePath: string, metadata: SongMetadata): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return;
  }

  const tags: Record<string, string> = {};
  if (metadata.title) tags.title = metadata.title;
  if (metadata.artist) tags.artist = metadata.artist;
  if (metadata.album) tags.album = metadata.album;
  if (metadata.lyrics) tags.lyrics = metadata.lyrics;

  const dst = getTempPath(filePath);
  const args = ['-y', '-i', filePath];

  if (metadata.coverPath) {
    args.push('-i', metadata.coverPath);
    args.push('-map', '0:a', '-map', '1:v', '-c', 'copy', '-disposition:v:0', 'attached_pic');
  } else {
    args.push('-map', '0:0');
    args.push('-codec', 'copy');
  }

  for (const [name, value] of Object.entries(tags)) {
    args.push('-metadata', `${name}=${value}`);
  }

  if (ext === '.mp3') {
    args.push('-id3v2_version', '3');
  }
  args.push(dst);

  try {
    await execFileAsync(env.FFMPEG_PATH, args, {
      maxBuffer: 10 * 1024 * 1024,
    });
    await rename(dst, filePath);
  } catch (err) {
    await rm(dst, { force: true });
    logger.warn({ filePath, err }, 'Failed to embed metadata into audio file');
  }
}
