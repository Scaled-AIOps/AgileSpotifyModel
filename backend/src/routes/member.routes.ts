/**
 * Purpose: Express router for Member CRUD + assignments lookup.
 * Usage:   Mounted at `/api/v1/members`. Exposes list / get / create / update / delete and `:id/assignments` (squads / chapters / guilds the member belongs to).
 * Goal:    HTTP surface for the people directory — the single source of identity for everything else (squads etc. reference members by id).
 * ToDo:    —
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createMemberSchema, updateMemberSchema } from '../schemas/member.schema';
import * as memberService from '../services/member.service';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await memberService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('PO'), validate(createMemberSchema), async (req, res, next) => {
  try { res.status(201).json(await memberService.create(req.body)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const m = await memberService.findById(req.params.id);
    if (!m) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(m);
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('Admin'), validate(updateMemberSchema), async (req, res, next) => {
  try { res.json(await memberService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', authorize('Admin'), async (req, res, next) => {
  try { await memberService.remove(req.params.id); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/:id/assignments', async (req, res, next) => {
  try { res.json(await memberService.getAssignments(req.params.id)); } catch (e) { next(e); }
});

export default router;
