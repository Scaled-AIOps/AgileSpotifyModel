/**
 * Purpose: Zod schemas for the Certificate registry.
 * Usage:   Imported by certificate.routes.ts.
 * Goal:    Validate cert metadata at the API boundary. Note we accept
 *          subjectAltNames + tags as structured input here; the route
 *          handler is responsible for JSON-encoding them before they hit
 *          the Redis hash.
 */
import { z } from 'zod';

const STATUS = ['active', 'pending-renewal', 'revoked'] as const;

export const createCertificateSchema = z.object({
  certId:            z.string().min(1).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers and hyphens'),
  commonName:        z.string().min(1).max(253),
  subjectAltNames:   z.array(z.string().min(1)).optional().default([]),
  issuer:            z.string().min(1),
  serialNumber:      z.string().min(1),
  fingerprintSha256: z.string().regex(/^[A-Fa-f0-9:]{47,95}$/, 'Expect a hex SHA-256 fingerprint (with or without colons)'),
  notBefore:         z.string().datetime(),
  notAfter:          z.string().datetime(),
  environment:       z.string().min(1),
  platformId:        z.string().optional().default(''),
  appId:             z.string().optional().default(''),
  squadId:           z.string().min(1),
  status:            z.enum(STATUS).default('active'),
  autoRenewal:       z.boolean().optional().default(false),
  tags:              z.record(z.string()).optional().default({}),
}).refine((c) => Date.parse(c.notAfter) > Date.parse(c.notBefore), {
  message: 'notAfter must be after notBefore',
  path: ['notAfter'],
});

export const updateCertificateSchema = z.object({
  commonName:        z.string().min(1).max(253).optional(),
  subjectAltNames:   z.array(z.string().min(1)).optional(),
  issuer:            z.string().min(1).optional(),
  serialNumber:      z.string().min(1).optional(),
  fingerprintSha256: z.string().regex(/^[A-Fa-f0-9:]{47,95}$/).optional(),
  notBefore:         z.string().datetime().optional(),
  notAfter:          z.string().datetime().optional(),
  environment:       z.string().min(1).optional(),
  platformId:        z.string().optional(),
  appId:             z.string().optional(),
  squadId:           z.string().min(1).optional(),
  status:            z.enum(STATUS).optional(),
  autoRenewal:       z.boolean().optional(),
  tags:              z.record(z.string()).optional(),
});
