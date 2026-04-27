import { z } from 'zod';

export const createSubDomainSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  domainId: z.string().uuid(),
});

export const updateSubDomainSchema = createSubDomainSchema.omit({ domainId: true }).partial();
