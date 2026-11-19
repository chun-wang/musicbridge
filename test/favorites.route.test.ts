import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/favorites', () => ({
  listFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

import { createApp } from '../src/app';
import {
  addFavorite,
  listFavorites,
  removeFavorite,
} from '../src/services/favorites';

const app = createApp();

describe('favorites API', () => {
  beforeEach(() => {
    vi.mocked(listFavorites)
      .mockReset()
      .mockResolvedValue([{ uid: 'u1', title: '晴天' }]);
    vi.mocked(addFavorite)
      .mockReset()
      .mockImplementation(async (track) => [track]);
    vi.mocked(removeFavorite).mockReset().mockResolvedValue([]);
  });

  it('returns the favorites list on GET', async () => {
    const res = await request(app).get('/api/favorites');
    expect(res.status).toBe(200);
    expect(res.body.data.favorites).toEqual([{ uid: 'u1', title: '晴天' }]);
  });

  it('adds a favorite on POST', async () => {
    const res = await request(app)
      .post('/api/favorites')
      .send({ uid: 'u2', title: '七里香', artist: '周杰伦' });

    expect(res.status).toBe(201);
    expect(vi.mocked(addFavorite)).toHaveBeenCalledWith({
      uid: 'u2',
      title: '七里香',
      artist: '周杰伦',
    });
    expect(res.body.data.favorites).toHaveLength(1);
  });

  it('rejects POST without uid', async () => {
    const res = await request(app).post('/api/favorites').send({ title: '七里香' });
    expect(res.status).toBe(400);
    expect(vi.mocked(addFavorite)).not.toHaveBeenCalled();
  });

  it('removes a favorite on DELETE', async () => {
    const res = await request(app).delete('/api/favorites/u1');
    expect(res.status).toBe(200);
    expect(vi.mocked(removeFavorite)).toHaveBeenCalledWith('u1');
  });
});
