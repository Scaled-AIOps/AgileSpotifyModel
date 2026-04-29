/**
 * Purpose: Express router for InfraCluster CRUD.
 * Usage:   Mounted at `/api/v1/infra`. Exposes list / get / create / delete on
 *          infrastructure platforms (OpenShift / EKS / etc.) referenced by
 *          application deployments. Create is Admin-only.
 * Goal:    Lightweight catalogue of where applications run; primarily populated
 *          from config/infra.yaml at startup, with a REST POST for runtime
 *          additions by an Admin.
 * ToDo:    —
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createInfraSchema } from '../schemas/infra.schema';
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

router.post('/', authorize('Admin'), validate(createInfraSchema), async (req, res, next) => {
  try {
    const existing = await infraService.findById(req.body.platformId);
    if (existing) { res.status(409).json({ error: 'Cluster with this platformId already exists' }); return; }
    const cluster = await infraService.create({
      platformId:    req.body.platformId,
      name:          req.body.name,
      description:   req.body.description,
      clusterId:     req.body.clusterId,
      environment:   req.body.environment,
      host:          req.body.host,
      routeHostName: req.body.routeHostName,
      platform:      req.body.platform,
      platformType:  req.body.platformType,
      tokenId:       req.body.tokenId,
      tags:          JSON.stringify(req.body.tags ?? {}),
    });
    res.status(201).json(cluster);
  } catch (e) { next(e); }
});

router.delete('/:platformId', authorize('Admin'), async (req, res, next) => {
  try { await infraService.remove(req.params.platformId); res.status(204).send(); } catch (e) { next(e); }
});

export default router;
