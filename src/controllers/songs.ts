import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as songService from '../services/songs';

const createSongSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  author: z.string().trim().min(1, 'author is required'),
  album: z.string().trim().min(1).optional(),
  lyrics: z.string().min(1).optional(),
  createdAt: z.string().trim().min(1, 'createdAt must be a date string').optional(),
  url: z.string().url('url must be a valid URL').optional(),
  cover: z.string().url('cover must be a valid URL').optional(),
});

export async function createSong(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = createSongSchema.parse(req.body);
    const song = await songService.createSong(input);
    res.status(201).json({ data: song });
  } catch (err) {
    next(err);
  }
}
