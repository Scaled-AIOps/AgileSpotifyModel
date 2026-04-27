import redis from '../config/redis';
import type { AppDeployment, DeployState } from '../models/index';

const LOG_MAX = 50;

export async function record(
  appId: string,
  env: string,
  event: {
    version: string;
    commitId: string;
    branch: string;
    deployedBy: string;
    state: DeployState;
    deployedAt: string;
    notes?: string;
    xray?: string;
    javaVersion?: string;
    javaComplianceStatus?: string;
    changeRequest?: string;
  },
): Promise<AppDeployment> {
  const deployment: AppDeployment = {
    appId,
    env,
    version:              event.version,
    commitId:             event.commitId,
    branch:               event.branch,
    deployedBy:           event.deployedBy,
    state:                event.state,
    deployedAt:           event.deployedAt,
    notes:                event.notes                ?? '',
    xray:                 event.xray                 ?? '',
    javaVersion:          event.javaVersion          ?? '',
    javaComplianceStatus: event.javaComplianceStatus ?? '',
    changeRequest:        event.changeRequest        ?? '',
  };
  const json = JSON.stringify(deployment);
  const logKey    = `appstatus:${appId}:${env}:log`;
  const latestKey = `appstatus:${appId}:${env}:latest`;
  await redis.pipeline()
    .lpush(logKey, json)
    .ltrim(logKey, 0, LOG_MAX - 1)
    .set(latestKey, json)
    .exec();
  return deployment;
}

export async function getHistory(appId: string, env: string): Promise<AppDeployment[]> {
  const items = await redis.lrange(`appstatus:${appId}:${env}:log`, 0, -1);
  return items.map((s) => JSON.parse(s) as AppDeployment);
}

export async function getLatest(appId: string, env: string): Promise<AppDeployment | null> {
  const s = await redis.get(`appstatus:${appId}:${env}:latest`);
  return s ? (JSON.parse(s) as AppDeployment) : null;
}

export async function getLatestAll(appId: string): Promise<Record<string, AppDeployment>> {
  const envs = ['local', 'dev', 'int', 'uat', 'prd'];
  const results = await Promise.all(envs.map((env) => getLatest(appId, env)));
  const out: Record<string, AppDeployment> = {};
  envs.forEach((env, i) => { if (results[i]) out[env] = results[i]!; });
  return out;
}
