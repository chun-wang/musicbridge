import { copyFile, mkdir, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function getTempRoot(): string {
  return path.join(os.tmpdir(), 'music-connect');
}

export async function ensureTempDir(subDir?: string): Promise<string> {
  const dir = subDir ? path.join(getTempRoot(), subDir) : getTempRoot();
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function moveFile(src: string, dest: string): Promise<void> {
  try {
    await rename(src, dest);
  } catch (err) {
    if ((err as { code?: string }).code !== 'EXDEV') {
      throw err;
    }
    await copyFile(src, dest);
    await rm(src, { force: true });
  }
}
