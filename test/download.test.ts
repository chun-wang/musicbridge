import { createServer } from 'node:http';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { downloadSong } from '../src/services/download';
import { embedMetadata } from '../src/services/tags';

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let tmpDir: string;

function generateAudio(format: 'mp3' | 'flac', outFile: string): void {
  execFileSync(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', '-ac', '1', '-codec:a', format, outFile],
    { stdio: 'ignore' },
  );
}

function readTags(filePath: string): Record<string, string> {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format_tags', '-of', 'json', filePath],
    { encoding: 'utf8' },
  );
  const parsed = JSON.parse(out) as { format?: { tags?: Record<string, string> } };
  return parsed.format?.tags ?? {};
}

function hasCoverStream(filePath: string): boolean {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'json', filePath],
    { encoding: 'utf8' },
  );
  const parsed = JSON.parse(out) as { streams?: { codec_type?: string }[] };
  return (parsed.streams ?? []).some((s) => s.codec_type === 'video');
}

function readId3Version(filePath: string): string | null {
  const buf = readFileSync(filePath);
  if (buf.length < 6 || buf.toString('ascii', 0, 3) !== 'ID3') {
    return null;
  }
  return `${buf[3]}.${buf[4]}`;
}

function generateCover(outFile: string): void {
  execFileSync(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'color=c=red:size=300x300', '-frames:v', '1', outFile],
    { stdio: 'ignore' },
  );
}

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'music-download-test-'));
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/no-ext') {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' });
      res.end(Buffer.from([0xff, 0xfb, 0x90]));
      return;
    }
    if (url.pathname === '/with-ext.mp3') {
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' });
      res.end(Buffer.from([0xff, 0xfb, 0x90]));
      return;
    }
    if (url.pathname === '/no-ext-no-type') {
      res.writeHead(200, { 'Content-Length': '3' });
      res.end(Buffer.from([0xff, 0xfb, 0x90]));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  server.close();
  await rm(tmpDir, { recursive: true, force: true });
});

describe('downloadSong file extension', () => {
  it('keeps extension from URL when present', async () => {
    const result = await downloadSong(`${baseUrl}/with-ext.mp3`, tmpDir, '晴天-周杰伦');
    expect(result.fileName).toBe('晴天-周杰伦.mp3');
    expect(result.tempPath).toMatch(/\.晴天-周杰伦\.mp3\..+\.part\.mp3$/);
    await expect(readFile(result.tempPath!)).resolves.toHaveLength(3);
  });

  it('falls back to content-type extension when URL has none', async () => {
    const result = await downloadSong(`${baseUrl}/no-ext`, tmpDir, '晴天-周杰伦');
    expect(result.fileName).toBe('晴天-周杰伦.mp3');
    expect(result.tempPath).toMatch(/\.晴天-周杰伦\.mp3\..+\.part\.mp3$/);
  });

  it('defaults to .mp3 when neither URL nor content-type provides an extension', async () => {
    const result = await downloadSong(`${baseUrl}/no-ext-no-type`, tmpDir, '晴天-周杰伦');
    expect(result.fileName).toBe('晴天-周杰伦.mp3');
    expect(result.tempPath).toMatch(/\.晴天-周杰伦\.mp3\..+\.part\.mp3$/);
  });

  it('reports downloaded size', async () => {
    const result = await downloadSong(`${baseUrl}/with-ext.mp3`, tmpDir, 'song-size');
    expect(result.size).toBe(3);
  });
});

describe('embedMetadata', () => {
  it('embeds lyrics and title into an mp3 file', async () => {
    const filePath = path.join(tmpDir, 'test.mp3');
    generateAudio('mp3', filePath);

    await embedMetadata(filePath, {
      title: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      lyrics: '[00:00.00]故事的小黄花',
    });

    const tags = readTags(filePath);
    expect(tags.title).toBe('晴天');
    expect(tags.artist).toBe('周杰伦');
    expect(tags.album).toBe('叶惠美');
    expect(tags.lyrics).toContain('[00:00.00]故事的小黄花');
  });

  it('embeds lyrics and title into a flac file', async () => {
    const filePath = path.join(tmpDir, 'test.flac');
    generateAudio('flac', filePath);

    await embedMetadata(filePath, {
      title: '晴天',
      artist: '周杰伦',
      album: '叶惠美',
      lyrics: '[00:00.00]故事的小黄花',
    });

    const tags = readTags(filePath);
    expect(tags.title).toBe('晴天');
    expect(tags.artist).toBe('周杰伦');
    expect(tags.album).toBe('叶惠美');
    expect(tags.lyrics).toContain('[00:00.00]故事的小黄花');
  });

  it('embeds cover into an mp3 file using ID3v2.3 for compatibility', async () => {
    const filePath = path.join(tmpDir, 'cover.mp3');
    const coverPath = path.join(tmpDir, 'cover.jpg');
    generateAudio('mp3', filePath);
    generateCover(coverPath);

    await embedMetadata(filePath, { title: '晴天', coverPath });

    expect(hasCoverStream(filePath)).toBe(true);
    expect(readId3Version(filePath)).toBe('3.0');
  });

  it('embeds cover into a flac file using attached_pic disposition', async () => {
    const filePath = path.join(tmpDir, 'cover.flac');
    const coverPath = path.join(tmpDir, 'cover2.jpg');
    generateAudio('flac', filePath);
    generateCover(coverPath);

    await embedMetadata(filePath, { title: '晴天', coverPath });

    expect(hasCoverStream(filePath)).toBe(true);
  });
});
