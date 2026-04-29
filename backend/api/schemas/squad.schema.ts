/**
 * Purpose: Zod schemas for Squad create / update.
 * Usage:   Imported by squad.routes.ts. Validates key, po, sm, missionStatement and spreads `linksFields`.
 * Goal:    Validate squad inputs at the API boundary.
 * ToDo:    Same UUID-vs-slug mismatch on `tribeId` as tribe.schema.
 */
import { z } from 'zod';
import { linksFields } from './links.schema';

export const createSquadSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  tribeId: z.string().uuid(),
  leadMemberId: z.union([z.string().uuid(), z.literal('')]).default(''),
  missionStatement: z.string().default(''),
  key: z.string().optional(),
  po: z.string().optional(),
  sm: z.string().optional(),
  ...linksFields,
});

export const updateSquadSchema = createSquadSchema.omit({ tribeId: true }).partial();
