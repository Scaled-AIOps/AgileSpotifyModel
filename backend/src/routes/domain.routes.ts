/**
 * Purpose: Express router for Domain CRUD + tree expansion.
 * Usage:   Mounted at `/api/v1/domains`. Exposes list / get / create / update / delete plus `:id/subdomains`, `:id/tribes`, `:id/tree`.
 * Goal:    HTTP surface for the highest level of the org hierarchy.
 * ToDo:    —
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createDomainSchema, updateDomainSchema } from '../schemas/domain.schema';
import * as domainService from '../services/domain.service';

const router = Router();

router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await domainService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('Admin'), validate(createDomainSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await domainService.create(req.body)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const d = await domainService.findById(req.params.id);
    if (!d) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(d);
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('Admin'), validate(updateDomainSchema), async (req, res, next) => {
  try { res.json(await domainService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', authorize('Admin'), async (req, res, next) => {
  try { await domainService.remove(req.params.id); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/:id/subdomains', async (req, res, next) => {
  try { res.json(await domainService.getSubdomains(req.params.id)); } catch (e) { next(e); }
});

router.get('/:id/tribes', async (req, res, next) => {
  try { res.json(await domainService.getTribes(req.params.id)); } catch (e) { next(e); }
});

router.get('/:id/tree', async (req, res, next) => {
  try {
    const tree = await domainService.getTree(req.params.id);
    if (!tree) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(tree);
  } catch (e) { next(e); }
});

export default router;
