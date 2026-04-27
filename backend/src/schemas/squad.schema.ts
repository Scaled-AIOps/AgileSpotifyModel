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
  tier: z.string().optional(),
  ...linksFields,
});

export const updateSquadSchema = createSquadSchema.omit({ tribeId: true }).partial();
