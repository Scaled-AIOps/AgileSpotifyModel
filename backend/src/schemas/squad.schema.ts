import { z } from 'zod';

export const createSquadSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  tribeId: z.string().uuid(),
  leadMemberId: z.union([z.string().uuid(), z.literal('')]).default(''),
  missionStatement: z.string().default(''),
});

export const updateSquadSchema = createSquadSchema.omit({ tribeId: true }).partial();
