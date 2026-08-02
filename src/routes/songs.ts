import { Router } from 'express';
import { createSong } from '../controllers/songs';

const router = Router();

router.post('/', createSong);

export default router;
