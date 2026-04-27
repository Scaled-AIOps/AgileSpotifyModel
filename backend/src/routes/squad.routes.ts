/**
 * Purpose: Express router for Squad CRUD + member management + apps lookup.
 * Usage:   Mounted at `/api/v1/squads`. Exposes list / get / create / update / delete, `:id/members`, `:id/members/:memberId` (self / TribeLead+ guarded), `:id/members/:memberId/role`, `:id/lead`, `:id/apps`.
 * Goal:    HTTP surface for squads — the smallest team unit that owns applications.
 * ToDo:    PO PATCH should additionally enforce squad ownership (currently only authorize('PO') rank check).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createSquadSchema, updateSquadSchema } from '../schemas/squad.schema';
import * as squadService from '../services/squad.service';
import * as appService from '../services/app.service';
import redis from '../config/redis';
import { SQUAD_ROLES } from '../models/index';

const router = Router();
router.use(authenticate);

async function canManageSquadMembers(userId: string, role: string, squadId: string): Promise<boolean> {
  if (role === 'Admin' || role === 'TribeLead' || role === 'AgileCoach') return true;
  const [squad, userData] = await Promise.all([
    squadService.findById(squadId),
    redis.hgetall(`user:${userId}`),
  ]);
  if (!squad || !userData?.email) return false;
  return userData.email === squad.po || userData.email === squad.sm;
}

function requireSquadManage(req: Request, res: Response, next: NextFunction, squadIdParam = 'id') {
  const { userId, role } = req.user!;
  canManageSquadMembers(userId, role, req.params[squadIdParam])
    .then((ok) => ok ? next() : res.status(403).json({ error: 'Forbidden' }))
    .catch(next);
}

// ── Squad CRUD ────────────────────────────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try { res.json(await squadService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('TribeLead'), validate(createSquadSchema), async (req, res, next) => {
  try { res.status(201).json(await squadService.create(req.body)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const s = await squadService.findById(req.params.id);
    if (!s) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(s);
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('PO'), validate(updateSquadSchema), async (req, res, next) => {
  try { res.json(await squadService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', authorize('Admin'), async (req, res, next) => {
  try { await squadService.remove(req.params.id); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/:id/members', async (req, res, next) => {
  try { res.json(await squadService.getMembers(req.params.id)); } catch (e) { next(e); }
});

router.post('/:id/members/:memberId',
  (req, res, next) => requireSquadManage(req, res, next, 'id'),
  validate(z.object({ squadRole: z.string().optional() })),
  async (req, res, next) => {
    try {
      await squadService.addMember(req.params.id, req.params.memberId, req.body.squadRole);
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

router.patch('/:id/members/:memberId/role',
  (req, res, next) => requireSquadManage(req, res, next, 'id'),
  validate(z.object({ squadRole: z.enum(SQUAD_ROLES as unknown as [string, ...string[]]) })),
  async (req, res, next) => {
    try {
      await squadService.updateMemberRole(req.params.id, req.params.memberId, req.body.squadRole);
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

router.delete('/:id/members/:memberId',
  (req, res, next) => requireSquadManage(req, res, next, 'id'),
  async (req, res, next) => {
    try { await squadService.removeMember(req.params.id, req.params.memberId); res.status(204).send(); } catch (e) { next(e); }
  }
);

router.patch('/:id/lead', authorize('TribeLead'), validate(z.object({ leadMemberId: z.string().uuid() })), async (req, res, next) => {
  try { res.json(await squadService.assignLead(req.params.id, req.body.leadMemberId)); } catch (e) { next(e); }
});

router.get('/:id/apps', async (req, res, next) => {
  try { res.json(await appService.findBySquad(req.params.id)); } catch (e) { next(e); }
});

export default router;
