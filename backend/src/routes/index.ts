import { Router } from 'express';
import { env } from '../config/env';
import authRoutes from './auth.routes';
import domainRoutes from './domain.routes';
import subdomainRoutes from './subdomain.routes';
import tribeRoutes from './tribe.routes';
import squadRoutes from './squad.routes';
import chapterRoutes from './chapter.routes';
import guildRoutes from './guild.routes';
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
router.use('/chapters', chapterRoutes);
router.use('/guilds', guildRoutes);
router.use('/members', memberRoutes);
router.use('/org', orgRoutes);
router.use('/infra', infraRoutes);
router.use('/apps', appsRoutes);

export default router;
