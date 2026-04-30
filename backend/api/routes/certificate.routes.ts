/**
 * Purpose: Express router for the Certificate registry.
 * Usage:   Mounted at `/api/v1/certificates`. List / get / create / update /
 *          delete on TLS/X.509 records used for expiry monitoring.
 * Goal:    Catalogue surface — "what certs do we own, when do they expire,
 *          who renews them?" Issuance is not in scope here.
 */
import { Router } from 'express';
import { authenticate, authenticateOrIngest } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { createCertificateSchema, updateCertificateSchema, validateCertificateSchema } from '../schemas/certificate.schema';
import * as certService from '../services/certificate.service';

const router = Router();

// Reads (list / get / validate / validation) accept either a user JWT or the
// ingest token so automated jobs can sweep certs without a per-user session.
// Writes still require a JWT — registry mutations stay tied to a real user.
router.get('/', authenticateOrIngest, async (_req, res, next) => {
  try { res.json(await certService.findAll()); } catch (e) { next(e); }
});

router.get('/:certId', authenticateOrIngest, async (req, res, next) => {
  try {
    const c = await certService.findById(req.params.certId);
    if (!c) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(c);
  } catch (e) { next(e); }
});

router.post('/', authenticate, authorize('TribeLead'), validate(createCertificateSchema), async (req, res, next) => {
  try {
    const existing = await certService.findById(req.body.certId);
    if (existing) { res.status(409).json({ error: `Certificate '${req.body.certId}' already exists` }); return; }
    const cert = await certService.create({
      certId:            req.body.certId,
      commonName:        req.body.commonName,
      subjectAltNames:   JSON.stringify(req.body.subjectAltNames ?? []),
      issuer:            req.body.issuer,
      serialNumber:      req.body.serialNumber,
      fingerprintSha256: req.body.fingerprintSha256,
      notBefore:         req.body.notBefore,
      notAfter:          req.body.notAfter,
      environment:       req.body.environment,
      platformId:        req.body.platformId ?? '',
      appId:             req.body.appId ?? '',
      squadId:           req.body.squadId,
      status:            req.body.status,
      autoRenewal:       req.body.autoRenewal ? 'true' : 'false',
      tags:              JSON.stringify(req.body.tags ?? {}),
    });
    res.status(201).json(cert);
  } catch (e) { next(e); }
});

router.patch('/:certId', authenticate, authorize('TribeLead'), validate(updateCertificateSchema), async (req, res, next) => {
  try {
    const data: Record<string, unknown> = { ...req.body };
    if (Array.isArray(data.subjectAltNames)) data.subjectAltNames = JSON.stringify(data.subjectAltNames);
    if (data.tags && typeof data.tags === 'object') data.tags = JSON.stringify(data.tags);
    if (typeof data.autoRenewal === 'boolean')      data.autoRenewal = data.autoRenewal ? 'true' : 'false';
    const updated = await certService.update(req.params.certId, data as never);
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:certId', authenticate, authorize('Admin'), async (req, res, next) => {
  try { await certService.remove(req.params.certId); res.status(204).send(); } catch (e) { next(e); }
});

// Live TLS probe — opens a connection to the cert's host (or an override host),
// fetches the actual cert chain, and reports drift between the registered
// metadata and what the server is presenting today. Result is cached for 7 days
// so the UI can display "last checked at …" without re-probing every page load.
//
// Accepts either a user JWT (Validate button in the SPA) or the shared
// INGEST_API_KEY so a CI job (TeamCity, cron, …) can sweep every cert
// without holding a per-user session.
router.post('/:certId/validate', authenticateOrIngest, validate(validateCertificateSchema), async (req, res, next) => {
  try {
    const result = await certService.validate(req.params.certId, req.body ?? {});
    res.json(result);
  } catch (e) { next(e); }
});

router.get('/:certId/validation', authenticateOrIngest, async (req, res, next) => {
  try {
    const result = await certService.getLastValidation(req.params.certId);
    if (!result) { res.status(404).json({ error: 'No validation result on file' }); return; }
    res.json(result);
  } catch (e) { next(e); }
});

export default router;
