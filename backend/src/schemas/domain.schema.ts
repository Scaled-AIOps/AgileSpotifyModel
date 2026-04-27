import { z } from 'zod';

export const createDomainSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
});

export const updateDomainSchema = createDomainSchema.partial();
