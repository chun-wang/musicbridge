import { Router } from 'express';
import { addFavorite, listFavorites, removeFavorite } from '../controllers/favorites';

const router = Router();

router.get('/', listFavorites);
router.post('/', addFavorite);
router.delete('/:uid', removeFavorite);

export default router;
