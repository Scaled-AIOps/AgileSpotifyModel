import { z } from 'zod';

export const createGuildSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  ownerMemberId: z.union([z.string().uuid(), z.literal('')]).default(''),
});

export const updateGuildSchema = createGuildSchema.partial();
