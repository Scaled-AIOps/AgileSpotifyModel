import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createChapterSchema, updateChapterSchema } from '../schemas/chapter.schema';
import * as chapterService from '../services/chapter.service';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await chapterService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('TribeLead'), validate(createChapterSchema), async (req, res, next) => {
  try { res.status(201).json(await chapterService.create(req.body)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const c = await chapterService.findById(req.params.id);
    if (!c) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(c);
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('TribeLead'), validate(updateChapterSchema), async (req, res, next) => {
  try { res.json(await chapterService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', authorize('Admin'), async (req, res, next) => {
  try { await chapterService.remove(req.params.id); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/:id/members', async (req, res, next) => {
  try { res.json(await chapterService.getMembers(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/members/:memberId', authorize('TribeLead'), async (req, res, next) => {
  try { await chapterService.addMember(req.params.id, req.params.memberId); res.status(204).send(); } catch (e) { next(e); }
});

router.delete('/:id/members/:memberId', authorize('TribeLead'), async (req, res, next) => {
  try { await chapterService.removeMember(req.params.id, req.params.memberId); res.status(204).send(); } catch (e) { next(e); }
});

router.patch('/:id/lead', authorize('TribeLead'), validate(z.object({ leadMemberId: z.string().uuid() })), async (req, res, next) => {
  try { res.json(await chapterService.assignLead(req.params.id, req.body.leadMemberId)); } catch (e) { next(e); }
});

export default router;
