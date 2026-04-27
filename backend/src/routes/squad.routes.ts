import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createSquadSchema, updateSquadSchema } from '../schemas/squad.schema';
import { createBacklogItemSchema, updateBacklogItemSchema, updateStatusSchema, reorderBacklogSchema } from '../schemas/backlog.schema';
import { createSprintSchema, updateSprintSchema } from '../schemas/sprint.schema';
import * as squadService from '../services/squad.service';
import * as backlogService from '../services/backlog.service';
import * as sprintService from '../services/sprint.service';
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

// ── Backlog ───────────────────────────────────────────────────────────────────

router.get('/:squadId/backlog', async (req, res, next) => {
  try { res.json(await backlogService.findBySquad(req.params.squadId)); } catch (e) { next(e); }
});

router.post('/:squadId/backlog', authorize('PO'), validate(createBacklogItemSchema), async (req, res, next) => {
  try { res.status(201).json(await backlogService.create(req.params.squadId, req.body)); } catch (e) { next(e); }
});

router.get('/:squadId/backlog/:itemId', async (req, res, next) => {
  try {
    const item = await backlogService.findById(req.params.itemId);
    if (!item) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(item);
  } catch (e) { next(e); }
});

router.patch('/:squadId/backlog/reorder', authorize('PO'), validate(reorderBacklogSchema), async (req, res, next) => {
  try { await backlogService.reorder(req.params.squadId, req.body.items); res.status(204).send(); } catch (e) { next(e); }
});

router.patch('/:squadId/backlog/:itemId', authorize('PO'), validate(updateBacklogItemSchema), async (req, res, next) => {
  try { res.json(await backlogService.update(req.params.itemId, req.body)); } catch (e) { next(e); }
});

router.patch('/:squadId/backlog/:itemId/status', validate(updateStatusSchema), async (req, res, next) => {
  try { res.json(await backlogService.updateStatus(req.params.itemId, req.body.status)); } catch (e) { next(e); }
});

router.delete('/:squadId/backlog/:itemId', authorize('PO'), async (req, res, next) => {
  try { await backlogService.remove(req.params.itemId); res.status(204).send(); } catch (e) { next(e); }
});

// ── Sprints ───────────────────────────────────────────────────────────────────

router.get('/:squadId/sprints', async (req, res, next) => {
  try { res.json(await sprintService.findBySquad(req.params.squadId)); } catch (e) { next(e); }
});

router.post('/:squadId/sprints', authorize('PO'), validate(createSprintSchema), async (req, res, next) => {
  try { res.status(201).json(await sprintService.create(req.params.squadId, req.body)); } catch (e) { next(e); }
});

router.get('/:squadId/sprints/active', async (req, res, next) => {
  try {
    const s = await sprintService.findActive(req.params.squadId);
    if (!s) { res.status(404).json({ error: 'No active sprint' }); return; }
    res.json(s);
  } catch (e) { next(e); }
});

router.get('/:squadId/sprints/:sprintId', async (req, res, next) => {
  try {
    const s = await sprintService.findById(req.params.sprintId);
    if (!s) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(s);
  } catch (e) { next(e); }
});

router.patch('/:squadId/sprints/:sprintId', authorize('PO'), validate(updateSprintSchema), async (req, res, next) => {
  try { res.json(await sprintService.update(req.params.sprintId, req.body)); } catch (e) { next(e); }
});

router.delete('/:squadId/sprints/:sprintId', authorize('PO'), async (req, res, next) => {
  try { await sprintService.remove(req.params.sprintId); res.status(204).send(); } catch (e) { next(e); }
});

router.post('/:squadId/sprints/:sprintId/start', authorize('PO'), async (req, res, next) => {
  try { res.json(await sprintService.start(req.params.squadId, req.params.sprintId)); } catch (e) { next(e); }
});

router.post('/:squadId/sprints/:sprintId/complete', authorize('PO'), async (req, res, next) => {
  try { res.json(await sprintService.complete(req.params.squadId, req.params.sprintId)); } catch (e) { next(e); }
});

router.post('/:squadId/sprints/:sprintId/items/:itemId', authorize('PO'), async (req, res, next) => {
  try { await sprintService.addItem(req.params.sprintId, req.params.itemId); res.status(204).send(); } catch (e) { next(e); }
});

router.delete('/:squadId/sprints/:sprintId/items/:itemId', authorize('PO'), async (req, res, next) => {
  try { await sprintService.removeItem(req.params.sprintId, req.params.itemId); res.status(204).send(); } catch (e) { next(e); }
});

export default router;
