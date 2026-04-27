/**
 * Purpose: Express router for organisation-wide aggregations.
 * Usage:   Mounted at `/api/v1/org`. `GET /tree` returns the full domain → tribe → squad nested tree; `GET /headcount` returns per-tribe member counts.
 * Goal:    Read-only roll-ups that stitch together multiple entity types in one request, used by the dashboard and the D3 org tree.
 * ToDo:    —
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import redis from '../config/redis';
import * as domainService from '../services/domain.service';

const router = Router();
router.use(authenticate);

router.get('/tree', async (_req, res, next) => {
  try {
    const domainIds = await redis.smembers('domains:all');
    const tree = await Promise.all(domainIds.map((id) => domainService.getTree(id)));
    res.json(tree.filter(Boolean));
  } catch (e) { next(e); }
});

router.get('/headcount', authorize('TribeLead'), async (_req, res, next) => {
  try {
    const tribeIds = await redis.smembers('tribes:all');
    const result = await Promise.all(tribeIds.map(async (tribeId) => {
      const tribe = await redis.hgetall(`tribe:${tribeId}`);
      const squadIds = await redis.smembers(`tribe:${tribeId}:squads`);
      const squads = await Promise.all(squadIds.map(async (squadId) => {
        const squad = await redis.hgetall(`squad:${squadId}`);
        const memberIds = await redis.smembers(`squad:${squadId}:members`);
        return { id: squadId, name: squad.name, memberCount: memberIds.length };
      }));
      const totalMembers = squads.reduce((sum, s) => sum + s.memberCount, 0);
      return { id: tribeId, name: tribe.name, memberCount: totalMembers, squads };
    }));
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
