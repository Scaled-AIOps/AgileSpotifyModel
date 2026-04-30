/**
 * Purpose: All TypeScript interfaces shared across the frontend SPA.
 * Usage:   Imported by every API client, component, and shared widget that needs an entity type. Mirrors the backend `models/index.ts`.
 * Goal:    Single source of truth for entity shapes on the frontend; includes the `Link` type used by jira / confluence / github / mailingList arrays.
 * ToDo:    —
 */
export type Role = 'Admin' | 'TribeLead' | 'PO' | 'AgileCoach' | 'ReleaseManager' | 'Member';

export interface User {
  id: string;
  email: string;
  role: Role;
  memberId: string;
  createdAt: string;
}

export const SQUAD_ROLES = [
  'Frontend Dev', 'Backend Dev', 'Full Stack Dev', 'BA', 'SM',
  'Tester', 'DevOps', 'AO', 'EM', 'Designer',
  'Data Engineer', 'ML Engineer', 'SRE', 'Tech Lead', 'Architect',
] as const;

/** A single labelled link. Used in arrays of jira/confluence/github/mailingList. */
export interface Link {
  url: string;
  description: string;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: Role;
  squadId: string;
  squadRole: string;
}

export interface Domain {
  id: string;
  name: string;
  description: string;
  jira: Link[];
  confluence: Link[];
  github: Link[];
  mailingList: Link[];
  createdAt: string;
  updatedAt: string;
}

export interface SubDomain {
  id: string;
  name: string;
  description: string;
  domainId: string;
  jira: Link[];
  confluence: Link[];
  github: Link[];
  mailingList: Link[];
}

export interface Tribe {
  id: string;
  name: string;        // short code, e.g. "PSS"
  tribeName: string;   // long form, e.g. "Payment System Services"
  description: string;
  domainId: string;
  subdomainId: string;
  leadMemberId: string;
  releaseManager: string;
  agileCoach: string;
  jira: Link[];
  confluence: Link[];
  github: Link[];
  mailingList: Link[];
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
  jira: Link[];
  confluence: Link[];
  github: Link[];
  mailingList: Link[];
  tier: string;
  memberCount?: number;
}

// ── AIOps / App Registry ──────────────────────────────────────────────────────

export type AppStatus = 'active' | 'inactive' | 'marked-for-decommissioning' | 'failed';
export type DeployState = 'success' | 'failed' | 'pending' | 'rolledback';

/** Per-cloud deployment block. Mirrors backend models/CloudPlatform. */
export interface CloudPlatform {
  localPlatform?: string;
  devPlatform?:   string;
  intPlatform?:   string;
  uatPlatform?:   string;
  prdPlatform?:   string;
  localUrl?:      string;
  devUrl?:        string;
  intUrl?:        string;
  uatUrl?:        string;
  prdUrl?:        string;
  buildChart?:    string;
  chart?:         string;
}

export interface App {
  appId: string;
  description: string;
  squadId: string;
  squadKey: string;
  status: AppStatus;
  tags: string;
  platforms: string;
  urls: string;
  ocp: CloudPlatform;
  gcp: CloudPlatform;
  jira: Link[];
  confluence: Link[];
  github: Link[];
  mailingList: Link[];
  /** Generic / miscellaneous labelled links (architecture docs, pipelines, dashboards, etc.). */
  links: Link[];
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

export interface AppWithDeploys extends App {
  latestDeploys: Record<string, AppDeployment>;
  editable: boolean;
}

export interface AuditEntry {
  id: string;
  appId: string;
  userId: string;
  userEmail: string;
  changedAt: string;
  action: string;
  changes: Record<string, { from: string; to: string }>;
}

export type InfraStatus = 'active' | 'inactive' | 'marked-for-decommissioning' | 'failed';

export interface InfraCluster {
  platformId: string;
  name: string;
  description: string;
  clusterId: string;
  environment: string;
  host: string;
  routeHostName: string;
  platform: string;
  platformType: string;
  tokenId: string;
  status: InfraStatus;
  tags: string;
  createdAt: string;
}

/**
 * Operator-set certificate state. The "expired" reading is derived at
 * render time from notAfter, not stored — so the persisted enum is narrower
 * than what the UI displays.
 */
export type CertificateStatus = 'active' | 'pending-renewal' | 'revoked';

export interface Certificate {
  certId: string;
  commonName: string;
  /** JSON-encoded string[] on the wire. */
  subjectAltNames: string;
  issuer: string;
  serialNumber: string;
  fingerprintSha256: string;
  notBefore: string;
  notAfter: string;
  environment: string;
  platformId: string;
  appId: string;
  squadId: string;
  status: CertificateStatus;
  autoRenewal: string;
  tags: string;
  createdAt: string;
}

// ── Org tree node shape returned by GET /org/tree ─────────────────────────────
export interface OrgTreeSquad extends Squad {
  memberCount: number;
  appCount: number;
}

export interface OrgTreeTribe extends Tribe {
  squads: OrgTreeSquad[];
}

export interface OrgTreeSubDomain extends SubDomain {
  tribes: OrgTreeTribe[];
}

export interface OrgTreeDomain extends Domain {
  subdomains: OrgTreeSubDomain[];
  tribes: OrgTreeTribe[];
}
