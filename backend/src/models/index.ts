export type Role = 'Admin' | 'TribeLead' | 'PO' | 'AgileCoach' | 'ReleaseManager' | 'Member';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  memberId: string;
  createdAt: string;
}

export const SQUAD_ROLES = [
  'Frontend Dev', 'Backend Dev', 'Full Stack Dev', 'BA', 'SM',
  'Tester', 'DevOps', 'AO', 'EM', 'Designer',
  'Data Engineer', 'ML Engineer', 'SRE', 'Tech Lead', 'Architect',
] as const;

export type SquadRole = typeof SQUAD_ROLES[number];

export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: Role;
  squadId: string;
  squadRole: string;
  chapterId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubDomain {
  id: string;
  name: string;
  description: string;
  domainId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tribe {
  id: string;
  name: string;
  description: string;
  domainId: string;
  subdomainId: string;
  leadMemberId: string;
  releaseManager: string;
  agileCoach: string;
  confluence: string;
  createdAt: string;
  updatedAt: string;
}

export interface Squad {
  id: string;
  name: string;
  description: string;
  tribeId: string;
  leadMemberId: string;
  missionStatement: string;
  key: string;
  po: string;
  sm: string;
  jira: string;
  confluence: string;
  mailingList: string;
  tier: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  name: string;
  discipline: string;
  tribeId: string;
  leadMemberId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guild {
  id: string;
  name: string;
  description: string;
  ownerMemberId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BacklogItem {
  id: string;
  squadId: string;
  title: string;
  description: string;
  type: 'Story' | 'Bug' | 'Task' | 'Epic';
  status: 'Backlog' | 'InProgress' | 'Review' | 'Done';
  priority: number;
  storyPoints: number;
  sprintId: string;
  assigneeId: string;
  epicId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  squadId: string;
  name: string;
  goal: string;
  status: 'Planning' | 'Active' | 'Completed';
  startDate: string;
  endDate: string;
  velocity: number;
  createdAt: string;
  updatedAt: string;
}

export interface InfraCluster {
  platformId: string;
  name: string;
  clusterId: string;
  environment: string;
  host: string;
  routeHostName: string;
  platform: string;
  platformType: string;
  tokenId: string;
  tags: string;
  createdAt: string;
}

export type AppStatus = 'active' | 'inactive' | 'marked-for-decommissioning' | 'failed';

export interface App {
  appId: string;
  gitRepo: string;
  squadId: string;
  squadKey: string;
  status: AppStatus;
  tags: string;
  platforms: string;
  urls: string;
  probeHealth: string;
  probeInfo: string;
  probeLiveness: string;
  probeReadiness: string;
  javaVersion: string;
  javaComplianceStatus: string;
  artifactoryUrl: string;
  xrayUrl: string;
  compositionViewerUrl: string;
  splunkUrl: string;
  createdAt: string;
}

export type DeployState = 'success' | 'failed' | 'pending' | 'rolledback';

export interface AppDeployment {
  appId: string;
  env: string;
  version: string;
  commitId: string;
  branch: string;
  deployedBy: string;
  state: DeployState;
  deployedAt: string;
  notes: string;
  xray: string;
  javaVersion: string;
  javaComplianceStatus: string;
  changeRequest: string;
}
