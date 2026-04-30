/**
 * Purpose: Redis-backed CRUD for the Certificate (TLS/X.509) registry.
 * Usage:   Called by certificate.routes.ts and the YAML seed loader. Indexed
 *          by environment via `cert:env:{env}` set so the dashboard can pull
 *          the per-environment expiry list cheaply.
 * Goal:    Persistence layer for cert *expiry monitoring* — we do not store
 *          private keys or issue certs from here.
 */
import tls from 'node:tls';
import redis from '../config/redis';
import { createError } from '../middleware/errorHandler';
import type { Certificate } from '../models/index';

/** Result of a live TLS probe against a registered certificate. */
export interface ValidationResult {
  certId: string;
  host: string;
  port: number;
  reachable: boolean;
  /** Whether Node's default chain verification accepted the presented chain. */
  chainValid: boolean;
  /** Whether the leaf cert's CN/SAN list covers `host`. */
  hostnameValid: boolean;
  liveCommonName: string;
  liveSubjectAltNames: string[];
  liveIssuer: string;
  liveSerialNumber: string;
  liveFingerprintSha256: string;
  liveNotBefore: string;
  liveNotAfter: string;
  /** Days from now until the *live* cert expires; negative if already expired. */
  expiresInDays: number;
  /** Per-field comparison against the registry record. */
  matches: {
    commonName: boolean;
    serialNumber: boolean;
    fingerprintSha256: boolean;
    notAfter: boolean;
  };
  validatedAt: string;
  /** Set when reachable=false, or when the chain failed verification. */
  error: string;
}

function fromHash(h: Record<string, string>): Certificate {
  return h as unknown as Certificate;
}

export async function create(data: Omit<Certificate, 'createdAt'>): Promise<Certificate> {
  const cert: Certificate = { ...data, createdAt: new Date().toISOString() };
  const pipeline = redis.pipeline();
  pipeline.hset(`cert:${data.certId}`, cert as unknown as Record<string, string>);
  pipeline.sadd('cert:all', data.certId);
  pipeline.sadd(`cert:env:${data.environment}`, data.certId);
  await pipeline.exec();
  return cert;
}

export async function findAll(): Promise<Certificate[]> {
  const ids = await redis.smembers('cert:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`cert:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((c) => c?.certId);
}

export async function findById(certId: string): Promise<Certificate | null> {
  const h = await redis.hgetall(`cert:${certId}`);
  return h?.certId ? fromHash(h) : null;
}

export async function findByEnv(env: string): Promise<Certificate[]> {
  const ids = await redis.smembers(`cert:env:${env}`);
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`cert:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((c) => c?.certId);
}

export async function update(
  certId: string,
  data: Partial<Omit<Certificate, 'certId' | 'createdAt'>>,
): Promise<Certificate> {
  const existing = await findById(certId);
  if (!existing) throw createError('Certificate not found', 404);
  const merged: Certificate = { ...existing, ...data };
  const pipeline = redis.pipeline();
  pipeline.hset(`cert:${certId}`, merged as unknown as Record<string, string>);
  if (data.environment && data.environment !== existing.environment) {
    pipeline.srem(`cert:env:${existing.environment}`, certId);
    pipeline.sadd(`cert:env:${data.environment}`, certId);
  }
  await pipeline.exec();
  return merged;
}

/**
 * Pick a probe-able host from a registered certificate. CN may be a wildcard
 * (`*.example.com`), in which case we fall back to the first non-wildcard SAN.
 */
function pickProbeHost(cert: Certificate): string {
  const cn = cert.commonName;
  if (cn && !cn.startsWith('*.')) return cn;
  try {
    const sans = cert.subjectAltNames ? (JSON.parse(cert.subjectAltNames) as string[]) : [];
    return sans.find((s) => !s.startsWith('*.')) ?? '';
  } catch {
    return '';
  }
}

function fingerprintHexToColon(hex: string): string {
  const compact = hex.replace(/[:\s]/g, '').toUpperCase();
  return compact.match(/.{1,2}/g)?.join(':') ?? compact;
}

function fingerprintEquals(a: string, b: string): boolean {
  return a.replace(/[:\s]/g, '').toUpperCase() === b.replace(/[:\s]/g, '').toUpperCase();
}

/**
 * Open a TLS connection to `host:port`, fetch the peer certificate, and
 * compare it to the registered record. We deliberately do *not* throw on a
 * failed chain — the whole point is to surface drift, so an invalid chain
 * comes back as `chainValid: false` with the rest of the data populated.
 *
 * Persisted under `cert:{certId}:validation` (7-day TTL) so the UI can show
 * "last checked X ago" without re-probing on every page load.
 */
export async function validate(
  certId: string,
  opts: { host?: string; port?: number; timeoutMs?: number } = {},
): Promise<ValidationResult> {
  const cert = await findById(certId);
  if (!cert) throw createError('Certificate not found', 404);

  const host = opts.host ?? pickProbeHost(cert);
  const port = opts.port ?? 443;
  const timeoutMs = opts.timeoutMs ?? 5000;

  if (!host) {
    throw createError(
      'Certificate has no probe-able host (CN is wildcard, no concrete SAN). Pass `host` in the request body.',
      400,
    );
  }

  const result = await probeTls(host, port, timeoutMs);
  const now = Date.now();

  const live: ValidationResult = {
    certId,
    host,
    port,
    reachable:             result.reachable,
    chainValid:            result.chainValid,
    hostnameValid:         result.hostnameValid,
    liveCommonName:        result.commonName,
    liveSubjectAltNames:   result.subjectAltNames,
    liveIssuer:            result.issuer,
    liveSerialNumber:      result.serialNumber,
    liveFingerprintSha256: result.fingerprintSha256,
    liveNotBefore:         result.notBefore,
    liveNotAfter:          result.notAfter,
    expiresInDays:         result.notAfter
      ? Math.floor((Date.parse(result.notAfter) - now) / 86_400_000)
      : 0,
    matches: {
      commonName:        result.commonName === cert.commonName,
      serialNumber:      result.serialNumber.replace(/[:\s]/g, '').toLowerCase()
                          === cert.serialNumber.replace(/[:\s]/g, '').toLowerCase(),
      fingerprintSha256: fingerprintEquals(result.fingerprintSha256, cert.fingerprintSha256),
      notAfter:          !!result.notAfter && Date.parse(result.notAfter) === Date.parse(cert.notAfter),
    },
    validatedAt: new Date().toISOString(),
    error:       result.error,
  };

  await redis.set(`cert:${certId}:validation`, JSON.stringify(live), 'EX', 7 * 24 * 3600);
  return live;
}

/**
 * Read the most recent validation result for a cert. Returns null if the
 * cert has never been validated (or the cached entry has expired).
 */
export async function getLastValidation(certId: string): Promise<ValidationResult | null> {
  const raw = await redis.get(`cert:${certId}:validation`);
  if (!raw) return null;
  try { return JSON.parse(raw) as ValidationResult; } catch { return null; }
}

interface RawProbe {
  reachable: boolean;
  chainValid: boolean;
  hostnameValid: boolean;
  commonName: string;
  subjectAltNames: string[];
  issuer: string;
  serialNumber: string;
  fingerprintSha256: string;
  notBefore: string;
  notAfter: string;
  error: string;
}

function probeTls(host: string, port: number, timeoutMs: number): Promise<RawProbe> {
  return new Promise((resolve) => {
    const empty: RawProbe = {
      reachable: false, chainValid: false, hostnameValid: false,
      commonName: '', subjectAltNames: [], issuer: '', serialNumber: '',
      fingerprintSha256: '', notBefore: '', notAfter: '', error: '',
    };

    let settled = false;
    const finish = (out: RawProbe) => { if (!settled) { settled = true; resolve(out); } };

    // rejectUnauthorized:false so we still get the peer cert when the chain is
    // bad — we want to *report* the invalidity, not crash on it.
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: timeoutMs });

    const timer = setTimeout(() => {
      finish({ ...empty, error: `Probe timed out after ${timeoutMs}ms` });
      socket.destroy();
    }, timeoutMs);

    socket.once('error', (err) => {
      clearTimeout(timer);
      finish({ ...empty, error: err.message || String(err) });
    });

    socket.once('secureConnect', () => {
      clearTimeout(timer);
      const cert = socket.getPeerCertificate(true);
      const fp = cert.fingerprint256 ?? '';
      const sans = (cert.subjectaltname ?? '')
        .split(',')
        .map((s) => s.trim().replace(/^DNS:/i, ''))
        .filter(Boolean);

      const hostnameError = tls.checkServerIdentity(host, cert);

      // X.509 allows multiple CN entries; flatten to a single string for display.
      const cn = cert.subject?.CN;
      const cnString = Array.isArray(cn) ? cn.join(', ') : (cn ?? '');

      finish({
        reachable:           true,
        chainValid:          socket.authorized,
        hostnameValid:       !hostnameError,
        commonName:          cnString,
        subjectAltNames:     sans,
        issuer:              Object.entries(cert.issuer ?? {})
                               .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`)
                               .join(', '),
        serialNumber:        cert.serialNumber ?? '',
        fingerprintSha256:   fingerprintHexToColon(fp),
        notBefore:           cert.valid_from ? new Date(cert.valid_from).toISOString() : '',
        notAfter:            cert.valid_to   ? new Date(cert.valid_to).toISOString()   : '',
        error:               socket.authorized ? '' : (socket.authorizationError?.toString() ?? ''),
      });
      socket.end();
    });
  });
}

export async function remove(certId: string): Promise<void> {
  const existing = await findById(certId);
  if (!existing) throw createError('Certificate not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`cert:${certId}`);
  pipeline.del(`cert:${certId}:validation`);
  pipeline.srem('cert:all', certId);
  pipeline.srem(`cert:env:${existing.environment}`, certId);
  await pipeline.exec();
}
