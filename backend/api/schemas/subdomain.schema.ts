/**
 * Purpose: Zod schemas for SubDomain create / update.
 * Usage:   Imported by subdomain.routes.ts. Spreads `linksFields`; require a UUID domainId on create (not on update).
 * Goal:    Validate sub-domain inputs at the API boundary.
 * ToDo:    —
 */
import { z } from 'zod';
import { linksFields } from './links.schema';

export const createSubDomainSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  domainId: z.string().uuid(),
  ...linksFields,
});

export const updateSubDomainSchema = createSubDomainSchema.omit({ domainId: true }).partial();
