import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createSubDomainSchema, updateSubDomainSchema } from '../schemas/subdomain.schema';
import * as subdomainService from '../services/subdomain.service';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res, next) => {
  try { res.json(await subdomainService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('Admin'), validate(createSubDomainSchema), async (req, res, next) => {
  try { res.status(201).json(await subdomainService.create(req.body)); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const sd = await subdomainService.findById(req.params.id);
    if (!sd) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(sd);
  } catch (e) { next(e); }
});

router.patch('/:id', authorize('Admin'), validate(updateSubDomainSchema), async (req, res, next) => {
  try { res.json(await subdomainService.update(req.params.id, req.body)); } catch (e) { next(e); }
});

router.delete('/:id', authorize('Admin'), async (req, res, next) => {
  try { await subdomainService.remove(req.params.id); res.status(204).send(); } catch (e) { next(e); }
});

router.get('/:id/tribes', async (req, res, next) => {
  try { res.json(await subdomainService.getTribes(req.params.id)); } catch (e) { next(e); }
});

export default router;
