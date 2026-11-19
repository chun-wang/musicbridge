import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '../src/services/favorites';
import type { FavoriteTrack } from '../src/types/favorite';

let tmpDir: string;
let originalMusicDir: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'music-favorites-test-'));
  originalMusicDir = env.MUSIC_DIR;
  env.MUSIC_DIR = tmpDir;
});

afterAll(async () => {
  env.MUSIC_DIR = originalMusicDir;
  await rm(tmpDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await rm(path.join(tmpDir, 'favorit.json'), { force: true });
});

describe('favorites service', () => {
  it('returns an empty list when the file does not exist', async () => {
    await expect(listFavorites()).resolves.toEqual([]);
  });

  it('adds favorites on top of the existing list', async () => {
    await addFavorite({ uid: 'u1', title: '晴天', artist: '周杰伦' });
    await addFavorite({ uid: 'u2', title: '七里香', artist: '周杰伦' });

    const favorites = await listFavorites();
    expect(favorites.map((item) => item.uid)).toEqual(['u1', 'u2']);
  });

  it('updates an existing favorite with the same uid', async () => {
    await addFavorite({ uid: 'u1', title: '旧标题' });
    await addFavorite({ uid: 'u1', title: '新标题' });

    const favorites = await listFavorites();
    expect(favorites).toHaveLength(1);
    expect(favorites[0].title).toBe('新标题');
  });

  it('removes a favorite and persists the remaining list', async () => {
    await addFavorite({ uid: 'u1', title: '晴天' });
    await addFavorite({ uid: 'u2', title: '七里香' });

    const favorites = await removeFavorite('u1');
    expect(favorites.map((item) => item.uid)).toEqual(['u2']);

    const raw = await readFile(path.join(tmpDir, 'favorit.json'), 'utf8');
    const parsed = JSON.parse(raw) as { favorites: FavoriteTrack[] };
    expect(parsed.favorites.map((item) => item.uid)).toEqual(['u2']);
  });

  it('returns the current list when removing an unknown uid', async () => {
    await addFavorite({ uid: 'u1', title: '晴天' });
    const favorites = await removeFavorite('missing');
    expect(favorites.map((item) => item.uid)).toEqual(['u1']);
  });
});
