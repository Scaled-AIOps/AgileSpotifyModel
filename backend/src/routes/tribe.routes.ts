import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createTribeSchema, updateTribeSchema } from '../schemas/tribe.schema';
import * as tribeService from '../services/tribe.service';
import { z } from 'zod';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await tribeService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('Admin'), validate(createTribeSchema), async (req, res, next) => {
  try { res.status(201).json(await tribeService.create(req.body)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const t = await tribeService.findById(req.params.id);
    if (!t) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(t);
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('TribeLead'), validate(updateTribeSchema), async (req, res, next) => {
  try { res.json(await tribeService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', authorize('Admin'), async (req, res, next) => {
  try { await tribeService.remove(req.params.id); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/:id/squads', async (req, res, next) => {
  try { res.json(await tribeService.getSquads(req.params.id)); } catch (e) { next(e); }
});

router.get('/:id/chapters', async (req, res, next) => {
  try { res.json(await tribeService.getChapters(req.params.id)); } catch (e) { next(e); }
});

router.patch('/:id/lead', authorize('Admin'), validate(z.object({ leadMemberId: z.string().uuid() })), async (req, res, next) => {
  try { res.json(await tribeService.assignLead(req.params.id, req.body.leadMemberId)); } catch (e) { next(e); }
});

export default router;
