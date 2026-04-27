import { z } from 'zod';

export const createTribeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  domainId: z.string().uuid(),
  subdomainId: z.union([z.string().uuid(), z.literal('')]).default(''),
  leadMemberId: z.union([z.string().uuid(), z.literal('')]).default(''),
});

export const updateTribeSchema = createTribeSchema.omit({ domainId: true }).partial();
