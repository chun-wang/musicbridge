import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type { FavoriteTrack } from '../types/favorite';
import { ensureTempDir, moveFile } from './temp';

const FAVORITES_FILE = 'favorit.json';

let queue: Promise<unknown> = Promise.resolve();

function withFileLock<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function getFilePath(): string {
  return path.join(env.MUSIC_DIR, FAVORITES_FILE);
}

function isFavoriteTrack(value: unknown): value is FavoriteTrack {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { uid?: unknown }).uid === 'string' &&
    (value as { uid: string }).uid.length > 0
  );
}

function extractFavorites(parsed: unknown): FavoriteTrack[] {
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { favorites?: unknown } | null)?.favorites;
  if (!Array.isArray(list)) {
    throw new AppError(500, 'Favorites file has invalid format');
  }
  return list.filter(isFavoriteTrack);
}

async function readFavorites(): Promise<FavoriteTrack[]> {
  let raw: string;
  try {
    raw = await readFile(getFilePath(), 'utf8');
  } catch (err) {
    if ((err as { code?: string }).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
  if (!raw.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError(500, 'Favorites file is not valid JSON');
  }
  return extractFavorites(parsed);
}

async function writeFavorites(favorites: FavoriteTrack[]): Promise<void> {
  const filePath = getFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempDir = await ensureTempDir('favorites');
  const tempPath = path.join(tempDir, `favorit.${randomUUID()}.json`);
  const payload = JSON.stringify(
    {
      version: 1,
      savedAt: new Date().toISOString(),
      favorites,
    },
    null,
    2,
  );
  await writeFile(tempPath, payload, 'utf8');
  await rm(filePath, { force: true });
  await moveFile(tempPath, filePath);
}

export function listFavorites(): Promise<FavoriteTrack[]> {
  return withFileLock(readFavorites);
}

export function addFavorite(track: FavoriteTrack): Promise<FavoriteTrack[]> {
  return withFileLock(async () => {
    const favorites = await readFavorites();
    const index = favorites.findIndex((item) => item.uid === track.uid);
    if (index >= 0) {
      favorites[index] = track;
    } else {
      favorites.push(track);
    }
    await writeFavorites(favorites);
    return favorites;
  });
}

export function removeFavorite(uid: string): Promise<FavoriteTrack[]> {
  return withFileLock(async () => {
    const favorites = await readFavorites();
    const next = favorites.filter((item) => item.uid !== uid);
    if (next.length !== favorites.length) {
      await writeFavorites(next);
    }
    return next;
  });
}
