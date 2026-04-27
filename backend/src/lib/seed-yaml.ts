/**
 * YAML-driven idempotent seed.
 * Called at server startup when NODE_ENV !== 'production'.
 * Reads config YAML files and creates any missing entities — never overwrites.
 */

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import * as domainSvc    from '../services/domain.service';
import * as subdomainSvc from '../services/subdomain.service';
import * as tribeSvc     from '../services/tribe.service';
import * as squadSvc     from '../services/squad.service';
import * as infraSvc     from '../services/infra.service';
import * as appSvc       from '../services/app.service';
import * as appstatusSvc from '../services/appstatus.service';
import type { Domain, SubDomain, Tribe } from '../models/index';
import type { DeployState, AppStatus } from '../models/index';

const CONFIG = path.resolve(__dirname, '../../config');

function loadYaml<T>(file: string): T[] {
  const p = path.join(CONFIG, file);
  if (!fs.existsSync(p)) return [];
  const raw = yaml.load(fs.readFileSync(p, 'utf8'));
  return Array.isArray(raw) ? (raw as T[]) : [];
}

interface YamlDomain    { name: string; description?: string }
interface YamlSubdomain { name: string; tribeDomain: string; description?: string }
interface YamlTribe     { name: string; subDomain: string; tribeDomain: string; releaseManager?: string; agileCoach?: string; description?: string; confluence?: string }
interface YamlSquad     { key: string; name: string; description?: string; tribe: string; po?: string; sm?: string; jira?: string; confluence?: string; mailingList?: string[]; tags?: Record<string, string> }
interface YamlInfra     { platformId: string; name: string; clusterId: string; environment: string; host: string; routeHostName: string; platform: string; platformType: string; tokenId: string; tags?: Record<string, string> }
interface YamlApp {
  appId: string; gitRepo: string; squad: string; status: AppStatus; tags?: Record<string, string>;
  localPlatform?: string; devPlatform?: string; intPlatform?: string; uatPlatform?: string; prdPlatform?: string;
  localUrl?: string; devUrl?: string; intUrl?: string; uatUrl?: string; prdUrl?: string;
  probeHealth?: string; probeInfo?: string; probeLiveness?: string; probeReadiness?: string;
  javaVersion?: string; javaComplianceStatus?: string;
}
interface YamlDeploy {
  version: string; commitId: string; branch: string; deployedBy: string; state: DeployState;
  deployedAt: string; notes?: string; xray?: string; javaVersion?: string;
  javaComplianceStatus?: string; changeRequest?: string;
}
interface YamlAppStatus { appId: string; env: string; deploy: YamlDeploy }

export async function seedFromYaml(): Promise<void> {
  let created = 0;
  let skipped = 0;

  // ── Domains ──────────────────────────────────────────────────────────────────
  const domainDefs = loadYaml<YamlDomain>('tribedomains.yaml');
  const allDomains = await domainSvc.findAll();
  const domainByName = new Map<string, Domain>(allDomains.map((d) => [d.name, d]));

  for (const d of domainDefs) {
    if (domainByName.has(d.name)) { skipped++; continue; }
    const nd = await domainSvc.create({ name: d.name, description: d.description ?? '' });
    domainByName.set(nd.name, nd);
    created++;
  }

  // ── Subdomains ────────────────────────────────────────────────────────────────
  const subdomainDefs = loadYaml<YamlSubdomain>('subdomains.yaml');
  const allSubdomains = await subdomainSvc.findAll();
  const subdomainByName = new Map<string, SubDomain>(allSubdomains.map((s) => [s.name, s]));

  for (const s of subdomainDefs) {
    if (subdomainByName.has(s.name)) { skipped++; continue; }
    const domain = domainByName.get(s.tribeDomain);
    if (!domain) { console.warn(`[seed] subdomain "${s.name}": domain "${s.tribeDomain}" not found`); skipped++; continue; }
    const ns = await subdomainSvc.create({ name: s.name, description: s.description ?? '', domainId: domain.id });
    subdomainByName.set(ns.name, ns);
    created++;
  }

  // ── Tribes ────────────────────────────────────────────────────────────────────
  const tribeDefs = loadYaml<YamlTribe>('tribes.yaml');
  const allTribes = await tribeSvc.findAll();
  const tribeByName = new Map<string, Tribe>(allTribes.map((t) => [t.name, t]));

  for (const t of tribeDefs) {
    if (tribeByName.has(t.name)) { skipped++; continue; }
    const domain = domainByName.get(t.tribeDomain);
    if (!domain) { console.warn(`[seed] tribe "${t.name}": domain "${t.tribeDomain}" not found`); skipped++; continue; }
    const subdomain = subdomainByName.get(t.subDomain);
    const nt = await tribeSvc.create({
      name: t.name, description: t.description ?? '', domainId: domain.id,
      subdomainId: subdomain?.id, releaseManager: t.releaseManager,
      agileCoach: t.agileCoach, confluence: t.confluence,
    });
    tribeByName.set(nt.name, nt);
    created++;
  }

  // ── Squads ────────────────────────────────────────────────────────────────────
  const squadDefs = loadYaml<YamlSquad>('squads.yaml');
  for (const s of squadDefs) {
    if (await squadSvc.findByKey(s.key)) { skipped++; continue; }
    const tribe = tribeByName.get(s.tribe);
    if (!tribe) { console.warn(`[seed] squad "${s.key}": tribe "${s.tribe}" not found`); skipped++; continue; }
    await squadSvc.create({
      key: s.key, name: s.name, description: s.description ?? '', tribeId: tribe.id,
      po: s.po, sm: s.sm, jira: s.jira, confluence: s.confluence,
      mailingList: Array.isArray(s.mailingList) ? s.mailingList[0] : s.mailingList,
      tier: s.tags?.tier,
    });
    created++;
  }

  // ── Infra clusters ────────────────────────────────────────────────────────────
  const infraDefs = loadYaml<YamlInfra>('infra.yaml');
  if (infraDefs.length) {
    const existingInfra = await infraSvc.findAll();
    const infraIds = new Set(existingInfra.map((c) => c.platformId));
    for (const c of infraDefs) {
      if (infraIds.has(c.platformId)) { skipped++; continue; }
      await infraSvc.create({
        platformId: c.platformId, name: c.name, clusterId: c.clusterId,
        environment: c.environment, host: c.host, routeHostName: c.routeHostName,
        platform: c.platform, platformType: c.platformType, tokenId: c.tokenId,
        tags: JSON.stringify(c.tags ?? {}),
      });
      infraIds.add(c.platformId);
      created++;
    }
  }

  // ── Apps ──────────────────────────────────────────────────────────────────────
  const appDefs = loadYaml<YamlApp>('appinfo.yaml');
  if (appDefs.length) {
    const existingApps = await appSvc.findAll();
    const appIds = new Set(existingApps.map((a) => a.appId));
    for (const a of appDefs) {
      if (appIds.has(a.appId)) { skipped++; continue; }
      const squad = await squadSvc.findByKey(a.squad);
      if (!squad) { console.warn(`[seed] app "${a.appId}": squad key "${a.squad}" not found`); skipped++; continue; }
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
        appId: a.appId, gitRepo: a.gitRepo, squadId: squad.id, squadKey: squad.key,
        status: a.status, tags: (a.tags as Record<string, string>) ?? {},
        platforms, urls, probeHealth: a.probeHealth, probeInfo: a.probeInfo,
        probeLiveness: a.probeLiveness, probeReadiness: a.probeReadiness,
        javaVersion: a.javaVersion, javaComplianceStatus: a.javaComplianceStatus,
      });
      appIds.add(a.appId);
      created++;
    }
  }

  // ── Deploy events ─────────────────────────────────────────────────────────────
  const statusDefs = loadYaml<YamlAppStatus>('appstatus.yaml');
  if (statusDefs.length) {
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
        const dk = `${s.deploy.version}::${s.deploy.deployedAt}`;
        if (existingKeys.has(dk)) { skipped++; continue; }
        await appstatusSvc.record(appId, env, s.deploy);
        existingKeys.add(dk);
        created++;
      }
    }
  }

  if (created || skipped) {
    console.log(`[seed] YAML seed complete — ${created} created, ${skipped} skipped`);
  }
}
