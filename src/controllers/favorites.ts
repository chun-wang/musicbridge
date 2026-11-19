import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import * as favoriteService from '../services/favorites';
import type { FavoriteTrack } from '../types/favorite';

const favoriteTrackSchema = z
  .object({
    uid: z.string().trim().min(1, 'uid is required'),
  })
  .catchall(z.unknown());

const uidSchema = z.string().trim().min(1, 'uid is required');

export async function listFavorites(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const favorites = await favoriteService.listFavorites();
    res.json({ data: { favorites } });
  } catch (err) {
    next(err);
  }
}

export async function addFavorite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const track = favoriteTrackSchema.parse(req.body) as FavoriteTrack;
    const favorites = await favoriteService.addFavorite(track);
    res.status(201).json({ data: { favorites } });
  } catch (err) {
    next(err);
  }
}

export async function removeFavorite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = uidSchema.parse(req.params.uid);
    const favorites = await favoriteService.removeFavorite(uid);
    res.json({ data: { favorites } });
  } catch (err) {
    next(err);
  }
}
