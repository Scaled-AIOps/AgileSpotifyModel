/**
 * Purpose: Top-level Express router that aggregates every entity sub-router.
 * Usage:   Mounted by app.ts at `/api/v1`; lazy-loads each entity router (auth, domains, tribes, …) and wires it under its sub-path.
 * Goal:    Keep the API URL layout (`/api/v1/<entity>`) in one file so routes are easy to audit and re-order.
 * ToDo:    —
 */
import { Router } from 'express';
import authRoutes from './auth.routes';
import domainRoutes from './domain.routes';
import subdomainRoutes from './subdomain.routes';
import tribeRoutes from './tribe.routes';
import squadRoutes from './squad.routes';
import memberRoutes from './member.routes';
import orgRoutes from './org.routes';
import infraRoutes from './infra.routes';
import appsRoutes from './apps.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/domains', domainRoutes);
router.use('/subdomains', subdomainRoutes);
router.use('/tribes', tribeRoutes);
router.use('/squads', squadRoutes);
router.use('/members', memberRoutes);
router.use('/org', orgRoutes);
router.use('/infra', infraRoutes);
router.use('/apps', appsRoutes);

export default router;
