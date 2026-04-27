/**
 * YAML-driven idempotent seed.
 * Reads tribedomains.yaml, subdomains.yaml, tribes.yaml, squads.yaml,
 * infra.yaml, appinfo.yaml, appstatus.yaml from backend/config/ and
 * creates any missing entities. Existing entries are never overwritten.
 *
 * Dependency order: domains → subdomains → tribes → squads → infra → apps → deploys
 *
 * Usage: npm run seed:yaml
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });
import '../src/config/env';
import { connectRedis } from '../src/config/redis';
import redis from '../src/config/redis';
import * as domainSvc    from '../src/services/domain.service';
import * as subdomainSvc from '../src/services/subdomain.service';
import * as tribeSvc     from '../src/services/tribe.service';
import * as squadSvc     from '../src/services/squad.service';
import * as infraSvc     from '../src/services/infra.service';
import * as appSvc       from '../src/services/app.service';
import * as appstatusSvc from '../src/services/appstatus.service';
import type { DeployState, AppStatus } from '../src/models/index';

const CONFIG = path.resolve(__dirname, '../config');

function loadYaml<T>(file: string): T[] {
  const p = path.join(CONFIG, file);
  if (!fs.existsSync(p)) return [];
  const raw = yaml.load(fs.readFileSync(p, 'utf8'));
  return Array.isArray(raw) ? (raw as T[]) : [];
}

// ── YAML shapes ───────────────────────────────────────────────────────────────

interface YamlDomain    { name: string; description: string; lead?: string }
interface YamlSubdomain { name: string; tribeDomain: string; lead?: string; description?: string }
interface YamlTribe     { name: string; subDomain: string; tribeDomain: string; lead?: string; releaseManager?: string; agileCoach?: string; description?: string; confluence?: string }
interface YamlSquad     { key: string; name: string; description?: string; tribe: string; po?: string; sm?: string; jira?: string; confluence?: string; mailingList?: string[]; tags?: Record<string, string> }
interface YamlInfra     { platformId: string; name: string; clusterId: string; environment: string; host: string; routeHostName: string; platform: string; platformType: string; tokenId: string; tags?: Record<string, string> }
interface YamlApp {
  appId: string;
  gitRepo: string;
  squad: string;
  status: AppStatus;
  tags?: Record<string, string>;
  localPlatform?: string; devPlatform?: string; intPlatform?: string; uatPlatform?: string; prdPlatform?: string;
  localUrl?: string; devUrl?: string; intUrl?: string; uatUrl?: string; prdUrl?: string;
  probeHealth?: string; probeInfo?: string; probeLiveness?: string; probeReadiness?: string;
  javaVersion?: string; javaComplianceStatus?: string;
}
interface YamlDeploy {
  version: string; commitId: string; branch: string; deployedBy: string;
  state: DeployState; deployedAt: string; notes?: string; xray?: string;
  javaVersion?: string; javaComplianceStatus?: string; changeRequest?: string;
}
interface YamlAppStatus { appId: string; env: string; deploy: YamlDeploy }

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  await connectRedis();

  let created = 0;
  let skipped = 0;

  // ── 1. Domains (from tribedomains.yaml — entries have no tribeDomain) ───────
  const domainDefs = loadYaml<YamlDomain>('tribedomains.yaml');
  const existingDomains = await domainSvc.findAll();
  const domainByName = new Map(existingDomains.map((d) => [d.name, d]));

  for (const d of domainDefs) {
    if (domainByName.has(d.name)) { skipped++; continue; }
    const nd = await domainSvc.create({ name: d.name, description: d.description ?? '' });
    domainByName.set(nd.name, nd);
    created++;
    console.log(`  + domain: ${nd.name}`);
  }

  // ── 2. Subdomains (from subdomains.yaml) ─────────────────────────────────────
  const subdomainDefs = loadYaml<YamlSubdomain>('subdomains.yaml');
  const existingSubdomains = await subdomainSvc.findAll();
  const subdomainByName = new Map(existingSubdomains.map((s) => [s.name, s]));

  for (const s of subdomainDefs) {
    if (subdomainByName.has(s.name)) { skipped++; continue; }
    const domain = domainByName.get(s.tribeDomain);
    if (!domain) { console.warn(`  ! subdomain ${s.name}: domain "${s.tribeDomain}" not found — skipping`); skipped++; continue; }
    const ns = await subdomainSvc.create({ name: s.name, description: s.description ?? '', domainId: domain.id });
    subdomainByName.set(ns.name, ns);
    created++;
    console.log(`  + subdomain: ${ns.name} (${s.tribeDomain})`);
  }

  // ── 3. Tribes ────────────────────────────────────────────────────────────────
  const tribeDefs = loadYaml<YamlTribe>('tribes.yaml');
  const existingTribes = await tribeSvc.findAll();
  const tribeByName = new Map(existingTribes.map((t) => [t.name, t]));

  for (const t of tribeDefs) {
    if (tribeByName.has(t.name)) { skipped++; continue; }
    const domain = domainByName.get(t.tribeDomain);
    if (!domain) { console.warn(`  ! tribe ${t.name}: domain "${t.tribeDomain}" not found — skipping`); skipped++; continue; }
    const subdomain = subdomainByName.get(t.subDomain);
    const nt = await tribeSvc.create({
      name: t.name,
      description: t.description ?? '',
      domainId: domain.id,
      subdomainId: subdomain?.id,
      releaseManager: t.releaseManager,
      agileCoach: t.agileCoach,
      confluence: t.confluence,
    });
    tribeByName.set(nt.name, nt);
    created++;
    console.log(`  + tribe: ${nt.name}`);
  }

  // ── 4. Squads ────────────────────────────────────────────────────────────────
  const squadDefs = loadYaml<YamlSquad>('squads.yaml');

  for (const s of squadDefs) {
    const existing = await squadSvc.findByKey(s.key);
    if (existing) { skipped++; continue; }
    const tribe = tribeByName.get(s.tribe);
    if (!tribe) { console.warn(`  ! squad ${s.key}: tribe "${s.tribe}" not found — skipping`); skipped++; continue; }
    const ns = await squadSvc.create({
      key: s.key,
      name: s.name,
      description: s.description ?? '',
      tribeId: tribe.id,
      po: s.po,
      sm: s.sm,
      jira: s.jira,
      confluence: s.confluence,
      mailingList: Array.isArray(s.mailingList) ? s.mailingList[0] : s.mailingList,
      tier: s.tags?.tier,
    });
    created++;
    console.log(`  + squad: ${ns.key} (${s.tribe})`);
  }

  // ── 5. Infra clusters ────────────────────────────────────────────────────────
  const infraDefs = loadYaml<YamlInfra>('infra.yaml');
  const existingInfra = await infraSvc.findAll();
  const infraByPlatformId = new Set(existingInfra.map((c) => c.platformId));

  for (const c of infraDefs) {
    if (infraByPlatformId.has(c.platformId)) { skipped++; continue; }
    await infraSvc.create({
      platformId:    c.platformId,
      name:          c.name,
      clusterId:     c.clusterId,
      environment:   c.environment,
      host:          c.host,
      routeHostName: c.routeHostName,
      platform:      c.platform,
      platformType:  c.platformType,
      tokenId:       c.tokenId,
      tags:          JSON.stringify(c.tags ?? {}),
    });
    infraByPlatformId.add(c.platformId);
    created++;
    console.log(`  + infra: ${c.platformId}`);
  }

  // ── 6. Apps ──────────────────────────────────────────────────────────────────
  const appDefs = loadYaml<YamlApp>('appinfo.yaml');
  const existingApps = await appSvc.findAll();
  const appByAppId = new Set(existingApps.map((a) => a.appId));

  for (const a of appDefs) {
    if (appByAppId.has(a.appId)) { skipped++; continue; }
    const squad = await squadSvc.findByKey(a.squad);
    if (!squad) { console.warn(`  ! app ${a.appId}: squad key "${a.squad}" not found — skipping`); skipped++; continue; }

    const platforms: Record<string, string> = {};
    if (a.localPlatform) platforms['local'] = a.localPlatform;
    if (a.devPlatform)   platforms['dev']   = a.devPlatform;
    if (a.intPlatform)   platforms['int']   = a.intPlatform;
    if (a.uatPlatform)   platforms['uat']   = a.uatPlatform;
    if (a.prdPlatform)   platforms['prd']   = a.prdPlatform;

    const urls: Record<string, string> = {};
    if (a.localUrl) urls['local'] = a.localUrl;
    if (a.devUrl)   urls['dev']   = a.devUrl;
    if (a.intUrl)   urls['int']   = a.intUrl;
    if (a.uatUrl)   urls['uat']   = a.uatUrl;
    if (a.prdUrl)   urls['prd']   = a.prdUrl;

    await appSvc.create({
      appId:                a.appId,
      gitRepo:              a.gitRepo,
      squadId:              squad.id,
      squadKey:             squad.key,
      status:               a.status,
      tags:                 (a.tags as Record<string, string>) ?? {},
      platforms,
      urls,
      probeHealth:          a.probeHealth,
      probeInfo:            a.probeInfo,
      probeLiveness:        a.probeLiveness,
      probeReadiness:       a.probeReadiness,
      javaVersion:          a.javaVersion,
      javaComplianceStatus: a.javaComplianceStatus,
    });
    appByAppId.add(a.appId);
    created++;
    console.log(`  + app: ${a.appId} (${a.squad})`);
  }

  // ── 7. Deploy events ─────────────────────────────────────────────────────────
  const statusDefs = loadYaml<YamlAppStatus>('appstatus.yaml');

  // Group deploys by appId+env so we can do one history fetch per pair
  const pairMap = new Map<string, YamlAppStatus[]>();
  for (const s of statusDefs) {
    const key = `${s.appId}::${s.env}`;
    if (!pairMap.has(key)) pairMap.set(key, []);
    pairMap.get(key)!.push(s);
  }

  for (const [, events] of pairMap) {
    const { appId, env } = events[0];
    const history = await appstatusSvc.getHistory(appId, env);
    const existingKeys = new Set(history.map((h) => `${h.version}::${h.deployedAt}`));

    for (const s of events) {
      const key = `${s.deploy.version}::${s.deploy.deployedAt}`;
      if (existingKeys.has(key)) { skipped++; continue; }
      await appstatusSvc.record(appId, env, {
        version:              s.deploy.version,
        commitId:             s.deploy.commitId,
        branch:               s.deploy.branch,
        deployedBy:           s.deploy.deployedBy,
        state:                s.deploy.state,
        deployedAt:           s.deploy.deployedAt,
        notes:                s.deploy.notes,
        xray:                 s.deploy.xray,
        javaVersion:          s.deploy.javaVersion,
        javaComplianceStatus: s.deploy.javaComplianceStatus,
        changeRequest:        s.deploy.changeRequest,
      });
      existingKeys.add(key);
      created++;
      console.log(`  + deploy: ${appId} [${env}] ${s.deploy.version}`);
    }
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped.`);
  await redis.quit();
}

seed().catch((err) => { console.error(err); process.exit(1); });
