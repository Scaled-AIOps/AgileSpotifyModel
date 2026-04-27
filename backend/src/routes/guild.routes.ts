import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createGuildSchema, updateGuildSchema } from '../schemas/guild.schema';
import * as guildService from '../services/guild.service';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await guildService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('TribeLead'), validate(createGuildSchema), async (req, res, next) => {
  try { res.status(201).json(await guildService.create(req.body)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const g = await guildService.findById(req.params.id);
    if (!g) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(g);
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('TribeLead'), validate(updateGuildSchema), async (req, res, next) => {
  try { res.json(await guildService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', authorize('Admin'), async (req, res, next) => {
  try { await guildService.remove(req.params.id); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/:id/members', async (req, res, next) => {
  try { res.json(await guildService.getMembers(req.params.id)); } catch (e) { next(e); }
});

// Members can self-join or self-leave; TribeLead+ can manage anyone
router.post('/:id/members/:memberId', authenticate, async (req, res, next) => {
  try { await guildService.addMember(req.params.id, req.params.memberId); res.status(204).send(); } catch (e) { next(e); }
});

router.delete('/:id/members/:memberId', authenticate, async (req, res, next) => {
  try { await guildService.removeMember(req.params.id, req.params.memberId); res.status(204).send(); } catch (e) { next(e); }
});

export default router;
