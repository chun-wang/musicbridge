import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import { downloadImage, downloadSong } from './download';
import { embedMetadata } from './tags';
import { ensureTempDir, moveFile } from './temp';
import type { CreateSongInput, Song } from '../types/song';

const songs = new Map<string, Song>();
const fileLocks = new Map<string, Promise<void>>();

function withFileLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = fileLocks.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  fileLocks.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export function listSongs(): Song[] {
  return [...songs.values()];
}

export function getSongById(id: string): Song {
  const song = songs.get(id);
  if (!song) {
    throw new AppError(404, `Song not found: ${id}`);
  }
  return song;
}

export async function createSong(input: CreateSongInput): Promise<Song> {
  const song: Song = {
    id: randomUUID(),
    ...input,
    receivedAt: new Date().toISOString(),
  };

  if (song.url) {
    const fileStem = `${song.title}-${song.author}`;
    const songUrl = song.url;
    const artistDir = path.join(env.MUSIC_DIR, song.author);
    const lockKey = `song:${fileStem}`;
    await withFileLock(lockKey, async () => {
      const download = await downloadSong(songUrl, artistDir, fileStem);
      if (!download.tempPath) {
        throw new AppError(502, 'Failed to download song: no file produced');
      }
      const coverPath = await downloadCoverIfPresent(song);
      await embedMetadata(download.tempPath, {
        title: song.title,
        artist: song.author,
        album: song.album,
        lyrics: song.lyrics,
        coverPath,
      });
      const finalPath = path.join(artistDir, download.fileName);
      await rm(finalPath, { force: true });
      await moveFile(download.tempPath, finalPath);
      if (coverPath) {
        await rm(coverPath, { force: true });
      }
      song.download = {
        fileName: path.join(song.author, download.fileName),
        size: download.size,
        downloadedAt: download.downloadedAt,
      };
    });
  }

  songs.set(song.id, song);
  return song;
}

async function downloadCoverIfPresent(song: Song): Promise<string | undefined> {
  if (!song.cover) {
    return undefined;
  }
  const destDir = await ensureTempDir('covers');
  const fileName = `${song.id}-cover`;
  const result = await downloadImage(song.cover, destDir, fileName);
  return path.join(destDir, result.fileName);
}

export function clearSongs(): void {
  songs.clear();
}
