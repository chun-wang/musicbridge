import request from 'supertest';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { clearSongs } from '../src/services/songs';
import { downloadImage, downloadSong } from '../src/services/download';

vi.mock('../src/services/download', () => ({
  downloadSong: vi.fn().mockResolvedValue({
    fileName: 'song.mp3',
    tempPath: 'C:/tmp/song.mp3',
    size: 1024,
    downloadedAt: '2026-08-01T00:00:00.000Z',
  }),
  downloadImage: vi.fn().mockResolvedValue({
    fileName: 'cover.jpg',
    size: 2048,
    downloadedAt: '2026-08-01T00:00:00.000Z',
  }),
}));

vi.mock('../src/services/tags', () => ({
  embedMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
  };
});

const app = createApp();

describe('GET /health', () => {
  it('returns 200 with ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('static html', () => {
  it('serves index.html at /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
  });

  it('injects enhanced handleDownloadCurrent that loads details before submit', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('async function handleDownloadCurrent(){');
    expect(res.text).toContain('if(!tr.detailsLoaded){await ensureTrackDetails(tr);}');
    expect(res.text).toContain("if(tr.cover)body.cover=tr.cover;");
  });

  it('returns 404 for unknown static files', async () => {
    const res = await request(app).get('/missing.html');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(404);
  });
});

describe('POST /api/songs', () => {
  beforeEach(() => {
    clearSongs();
    vi.mocked(downloadSong).mockClear();
    vi.mocked(downloadImage).mockClear();
  });

  it('creates a song and returns 201', async () => {
    const res = await request(app).post('/api/songs').send({
      title: '晴天',
      author: '周杰伦',
      album: '叶惠美',
      lyrics: '故事的小黄花...',
      createdAt: '2003-07-31',
      url: 'https://example.com/qing-tian.mp3',
    });
    expect(res.status).toBe(201);
    expect(vi.mocked(downloadSong)).toHaveBeenCalledWith(
      'https://example.com/qing-tian.mp3',
      path.join('music', '周杰伦'),
      '晴天-周杰伦',
    );
    expect(vi.mocked(downloadImage)).not.toHaveBeenCalled();
    expect(res.body.data).toMatchObject({
      title: '晴天',
      author: '周杰伦',
      album: '叶惠美',
      lyrics: '故事的小黄花...',
      createdAt: '2003-07-31',
      url: 'https://example.com/qing-tian.mp3',
      download: {
        fileName: path.join('周杰伦', 'song.mp3'),
        size: 1024,
        downloadedAt: '2026-08-01T00:00:00.000Z',
      },
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.receivedAt).toBeDefined();
  });

  it('downloads and embeds cover when cover url is provided', async () => {
    const res = await request(app).post('/api/songs').send({
      title: '晴天',
      author: '周杰伦',
      cover: 'https://example.com/cover.jpg',
      url: 'https://example.com/qing-tian.mp3',
    });
    expect(res.status).toBe(201);
    expect(vi.mocked(downloadImage)).toHaveBeenCalledTimes(1);
    expect(res.body.data.cover).toBe('https://example.com/cover.jpg');
  });

  it('returns 400 when cover url is invalid', async () => {
    const res = await request(app).post('/api/songs').send({
      title: 'Bad',
      author: 'Me',
      cover: 'not-a-url',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(400);
  });

  it('accepts optional fields omitted', async () => {
    const res = await request(app).post('/api/songs').send({
      title: 'Only Title',
      author: 'Me',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.album).toBeUndefined();
    expect(res.body.data.lyrics).toBeUndefined();
    expect(res.body.data.url).toBeUndefined();
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/songs').send({ author: 'Me' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(400);
  });

  it('returns 400 when url is not a valid URL', async () => {
    const res = await request(app).post('/api/songs').send({
      title: 'Bad',
      author: 'Me',
      url: 'not-a-url',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(400);
  });

  it('returns 400 when body is not JSON', async () => {
    const res = await request(app)
      .post('/api/songs')
      .set('Content-Type', 'application/json')
      .send('not json');
    expect(res.status).toBe(400);
  });
});
