/**
 * Purpose: Idempotent YAML startup seed.
 * Usage:   `seedFromYaml()` is called from index.ts on every non-production boot. It reads tribedomains / subdomains / tribes / squads / infra / appinfo / appstatus YAML files from CONFIG_DIR and creates any missing entities — never overwriting existing ones.
 * Goal:    Guarantee a known set of demo / staging entities exist after a deploy without requiring a destructive flush, and let ops teams iterate the config/*.yaml files via PRs.
 * ToDo:    Cover the YAML loader with vitest tests (per-entity create + skip-on-duplicate).
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

const CONFIG = process.env.CONFIG_DIR || path.resolve(process.cwd(), 'config');

function loadYaml<T>(file: string): T[] {
  const p = path.join(CONFIG, file);
  if (!fs.existsSync(p)) return [];
  const raw = yaml.load(fs.readFileSync(p, 'utf8'));
  return Array.isArray(raw) ? (raw as T[]) : [];
}

type YamlLinks = {
  jira?: unknown; confluence?: unknown; github?: unknown; mailingList?: unknown;
};
interface YamlDomain extends YamlLinks    { name: string; description?: string }
interface YamlSubdomain extends YamlLinks { name: string; tribeDomain: string; description?: string }
interface YamlTribe extends YamlLinks     { name: string; tribeName?: string; subDomain: string; tribeDomain: string; releaseManager?: string; agileCoach?: string; description?: string }
interface YamlSquad extends YamlLinks     { key: string; name: string; description?: string; tribe: string; po?: string; sm?: string; tags?: Record<string, string> }
interface YamlInfra { platformId: string; name: string; description?: string; clusterId: string; environment: string; host: string; routeHostName: string; platform: string; platformType: string; tokenId: string; tags?: Record<string, string> }
interface YamlPlatformBlock {
  localPlatform?: string; devPlatform?: string; intPlatform?: string; uatPlatform?: string; prdPlatform?: string;
  localUrl?: string;      devUrl?: string;      intUrl?: string;      uatUrl?: string;      prdUrl?: string;
  buildChart?: string; chart?: string;
}
interface YamlApp extends YamlLinks, YamlPlatformBlock {
  links?: unknown;
  appId: string; description?: string; gitRepo?: string; squad: string; status: AppStatus; tags?: Record<string, string>;
  ocp?: YamlPlatformBlock;
  gcp?: YamlPlatformBlock;
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
    const existing = domainByName.get(d.name);
    if (existing) {
      const updated = await domainSvc.update(existing.id, {
        description: d.description ?? '',
        jira: d.jira, confluence: d.confluence, github: d.github, mailingList: d.mailingList,
      });
      domainByName.set(updated.name, updated);
      continue;
    }
    const nd = await domainSvc.create({
      name: d.name, description: d.description ?? '',
      jira: d.jira, confluence: d.confluence, github: d.github, mailingList: d.mailingList,
    });
    domainByName.set(nd.name, nd);
    created++;
  }

  // ── Subdomains ────────────────────────────────────────────────────────────────
  const subdomainDefs = loadYaml<YamlSubdomain>('subdomains.yaml');
  const allSubdomains = await subdomainSvc.findAll();
  const subdomainByName = new Map<string, SubDomain>(allSubdomains.map((s) => [s.name, s]));

  for (const s of subdomainDefs) {
    const existingSd = subdomainByName.get(s.name);
    if (existingSd) {
      const updated = await subdomainSvc.update(existingSd.id, {
        description: s.description ?? '',
        jira: s.jira, confluence: s.confluence, github: s.github, mailingList: s.mailingList,
      });
      subdomainByName.set(updated.name, updated);
      continue;
    }
    const domain = domainByName.get(s.tribeDomain);
    if (!domain) { console.warn(`[seed] subdomain "${s.name}": domain "${s.tribeDomain}" not found`); skipped++; continue; }
    const ns = await subdomainSvc.create({
      name: s.name, description: s.description ?? '', domainId: domain.id,
      jira: s.jira, confluence: s.confluence, github: s.github, mailingList: s.mailingList,
    });
    subdomainByName.set(ns.name, ns);
    created++;
  }

  // ── Tribes ────────────────────────────────────────────────────────────────────
  const tribeDefs = loadYaml<YamlTribe>('tribes.yaml');
  const allTribes = await tribeSvc.findAll();
  const tribeByName = new Map<string, Tribe>();
  for (const t of allTribes) {
    tribeByName.set(t.name, t);
    if (t.tribeName && t.tribeName !== t.name) tribeByName.set(t.tribeName, t);
  }

  for (const t of tribeDefs) {
    if (tribeByName.has(t.name)) { skipped++; continue; }
    const domain = domainByName.get(t.tribeDomain);
    if (!domain) { console.warn(`[seed] tribe "${t.name}": domain "${t.tribeDomain}" not found`); skipped++; continue; }
    const subdomain = subdomainByName.get(t.subDomain);
    const nt = await tribeSvc.create({
      name: t.name, tribeName: t.tribeName ?? t.name,
      description: t.description ?? '', domainId: domain.id,
      subdomainId: subdomain?.id, releaseManager: t.releaseManager,
      agileCoach: t.agileCoach,
      jira: t.jira, confluence: t.confluence, github: t.github, mailingList: t.mailingList,
    });
    tribeByName.set(nt.name, nt);
    if (nt.tribeName && nt.tribeName !== nt.name) tribeByName.set(nt.tribeName, nt);
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
      po: s.po, sm: s.sm,
      jira: s.jira, confluence: s.confluence, github: s.github, mailingList: s.mailingList,
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
        platformId: c.platformId, name: c.name, description: c.description ?? '',
        clusterId: c.clusterId, environment: c.environment, host: c.host,
        routeHostName: c.routeHostName, platform: c.platform, platformType: c.platformType,
        tokenId: c.tokenId, tags: JSON.stringify(c.tags ?? {}),
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
      // Build legacy `platforms` / `urls` flat maps from any top-level *Platform /
      // *Url fields (back-compat for older YAML or API-created apps).
      const ENVS = ['local', 'dev', 'int', 'uat', 'prd'] as const;
      const platforms: Record<string, string> = {};
      const urls:      Record<string, string> = {};
      for (const env of ENVS) {
        const p = (a as any)[`${env}Platform`];
        const u = (a as any)[`${env}Url`];
        if (p) platforms[env] = p;
        if (u) urls[env]      = u;
      }
      const githubLinks: unknown = a.github ?? (a.gitRepo ? [a.gitRepo] : undefined);
      await appSvc.create({
        appId: a.appId, description: a.description ?? '',
        squadId: squad.id, squadKey: squad.key,
        status: a.status, tags: (a.tags as Record<string, string>) ?? {},
        platforms, urls,
        ocp: a.ocp ?? {}, gcp: a.gcp ?? {},
        jira: a.jira, confluence: a.confluence, github: githubLinks, mailingList: a.mailingList,
        links: a.links,
        probeHealth: a.probeHealth, probeInfo: a.probeInfo,
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
