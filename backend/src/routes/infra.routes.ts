import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import * as infraService from '../services/infra.service';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await infraService.findAll()); } catch (e) { next(e); }
});

router.get('/:platformId', async (req, res, next) => {
  try {
    const c = await infraService.findById(req.params.platformId);
    if (!c) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(c);
  } catch (e) { next(e); }
});

router.delete('/:platformId', authorize('Admin'), async (req, res, next) => {
  try { await infraService.remove(req.params.platformId); res.status(204).send(); } catch (e) { next(e); }
});

export default router;
