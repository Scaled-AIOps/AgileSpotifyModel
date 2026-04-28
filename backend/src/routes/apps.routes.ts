/**
 * Purpose: Express router for the Application registry.
 * Usage:   Mounted at `/api/v1/apps`. List / get / create / update / delete, audit log, and per-environment deployment history (`/:appId/:env/deploys`). Updates are gated by tribe membership via `resolveEditable`.
 * Goal:    HTTP surface for the AIOps application catalogue: status, links, deploy events, and tribe-scoped editing rules.
 * ToDo:    Cross-check that PATCH respects link-array zod validation when callers omit some link fields.
 */
import { Router, Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import * as appService from '../services/app.service';
import * as appstatusService from '../services/appstatus.service';
import * as auditService from '../services/audit.service';
import * as memberService from '../services/member.service';
import * as squadService from '../services/squad.service';
import { linksFields, genericLinksField } from '../schemas/links.schema';
import redis from '../config/redis';
import type { JwtPayload } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// ── Helpers ───────────────────────────────────────────────────────────────────

const safeUrl = z.string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Only HTTP and HTTPS URLs are allowed')
  .optional()
  .or(z.literal(''));

const cloudPlatformSchema = z.object({
  localPlatform: z.string().optional(),
  devPlatform:   z.string().optional(),
  intPlatform:   z.string().optional(),
  uatPlatform:   z.string().optional(),
  prdPlatform:   z.string().optional(),
  localUrl:      safeUrl,
  devUrl:        safeUrl,
  intUrl:        safeUrl,
  uatUrl:        safeUrl,
  prdUrl:        safeUrl,
  buildChart:    z.string().optional(),
  chart:         z.string().optional(),
}).strict().optional();

async function resolveEditable(appSquadId: string, user: JwtPayload): Promise<boolean> {
  if (user.role === 'Admin' || user.role === 'AgileCoach') return true;
  if (!user.memberId) return false;
  const member = await memberService.findById(user.memberId);
  if (!member?.squadId) return false;
  const [userSquad, appSquad] = await Promise.all([
    squadService.findById(member.squadId),
    squadService.findById(appSquadId),
  ]);
  if (!userSquad || !appSquad) return false;
  return userSquad.tribeId === appSquad.tribeId;
}

// ── Create-app schema ─────────────────────────────────────────────────────────

const createAppSchema = z.object({
  appId:                z.string().min(1).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  description:          z.string().optional().default(''),
  squadId:              z.string().min(1),
  status:               z.enum(['active', 'inactive', 'marked-for-decommissioning', 'failed']).default('active'),
  tags:                 z.record(z.string()).optional().default({}),
  platforms:            z.record(z.string()).optional().default({}),
  urls:                 z.record(z.string()).optional().default({}),
  ocp:                  cloudPlatformSchema,
  gcp:                  cloudPlatformSchema,
  javaVersion:          z.string().optional(),
  javaComplianceStatus: z.string().optional(),
  artifactoryUrl:       safeUrl,
  xrayUrl:              safeUrl,
  compositionViewerUrl: safeUrl,
  splunkUrl:            safeUrl,
  probeHealth:          z.string().optional(),
  probeInfo:            z.string().optional(),
  probeLiveness:        z.string().optional(),
  probeReadiness:       z.string().optional(),
  ...linksFields,
  links:                genericLinksField,
});

// ── Deploy schema ─────────────────────────────────────────────────────────────

const recordDeploySchema = z.object({
  version:              z.string().min(1),
  commitId:             z.string().min(1),
  branch:               z.string().min(1),
  deployedBy:           z.string().min(1),
  state:                z.enum(['success', 'failed', 'pending', 'rolledback']),
  deployedAt:           z.string().datetime().optional().default(() => new Date().toISOString()),
  notes:                z.string().optional(),
  xray:                 safeUrl,
  javaVersion:          z.string().optional(),
  javaComplianceStatus: z.string().optional(),
  changeRequest:        z.string().optional(),
});

// ── App CRUD ──────────────────────────────────────────────────────────────────

router.get('/', async (_req, res, next) => {
  try { res.json(await appService.findAll()); } catch (e) { next(e); }
});

router.post('/', authorize('TribeLead'), validate(createAppSchema), async (req, res, next) => {
  try {
    const existing = await appService.findById(req.body.appId);
    if (existing) { res.status(409).json({ error: `App '${req.body.appId}' already exists` }); return; }
    const squad = await squadService.findById(req.body.squadId);
    if (!squad) { res.status(400).json({ error: 'Squad not found' }); return; }
    const app = await appService.create({
      appId:                req.body.appId,
      description:          req.body.description ?? '',
      squadId:              req.body.squadId,
      squadKey:             squad.key ?? '',
      status:               req.body.status,
      tags:                 req.body.tags ?? {},
      platforms:            req.body.platforms ?? {},
      urls:                 req.body.urls ?? {},
      ocp:                  req.body.ocp ?? {},
      gcp:                  req.body.gcp ?? {},
      jira:                 req.body.jira,
      confluence:           req.body.confluence,
      github:               req.body.github,
      mailingList:          req.body.mailingList,
      links:                req.body.links,
      javaVersion:          req.body.javaVersion,
      javaComplianceStatus: req.body.javaComplianceStatus,
      artifactoryUrl:       req.body.artifactoryUrl,
      xrayUrl:              req.body.xrayUrl,
      compositionViewerUrl: req.body.compositionViewerUrl,
      splunkUrl:            req.body.splunkUrl,
      probeHealth:          req.body.probeHealth,
      probeInfo:            req.body.probeInfo,
      probeLiveness:        req.body.probeLiveness,
      probeReadiness:       req.body.probeReadiness,
    });
    res.status(201).json(app);
  } catch (e) { next(e); }
});

router.get('/:appId', async (req, res, next) => {
  try {
    const app = await appService.findById(req.params.appId);
    if (!app) { res.status(404).json({ error: 'Not found' }); return; }
    const [latestDeploys, editable] = await Promise.all([
      appstatusService.getLatestAll(req.params.appId),
      resolveEditable(app.squadId, req.user!),
    ]);
    res.json({ ...app, latestDeploys, editable });
  } catch (e) { next(e); }
});

router.patch('/:appId', async (req, res, next) => {
  try {
    const app = await appService.findById(req.params.appId);
    if (!app) { res.status(404).json({ error: 'Not found' }); return; }

    if (!(await resolveEditable(app.squadId, req.user!))) {
      res.status(403).json({ error: 'You must be within the same tribe to edit this application.' });
      return;
    }

    const { app: updated, diff } = await appService.update(req.params.appId, req.body);

    if (Object.keys(diff).length > 0) {
      const userData = await redis.hgetall(`user:${req.user!.userId}`);
      await auditService.record({
        appId:     req.params.appId,
        userId:    req.user!.userId,
        userEmail: userData?.email ?? req.user!.userId,
        action:    'update',
        changes:   diff,
      });
    }

    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:appId', authorize('Admin'), async (req, res, next) => {
  try { await appService.remove(req.params.appId); res.status(204).send(); } catch (e) { next(e); }
});

// ── Audit log ─────────────────────────────────────────────────────────────────

router.get('/:appId/audit', async (req, res, next) => {
  try { res.json(await auditService.getForApp(req.params.appId)); } catch (e) { next(e); }
});

// ── Deployment history ────────────────────────────────────────────────────────

router.get('/:appId/:env/deploys', async (req, res, next) => {
  try { res.json(await appstatusService.getHistory(req.params.appId, req.params.env)); } catch (e) { next(e); }
});

router.post('/:appId/:env/deploys', authorize('ReleaseManager'), validate(recordDeploySchema), async (req, res, next) => {
  try {
    const d = await appstatusService.record(req.params.appId, req.params.env, req.body);
    res.status(201).json(d);
  } catch (e) { next(e); }
});

export default router;
