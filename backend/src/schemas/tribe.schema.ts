import { z } from 'zod';
import { linksFields } from './links.schema';

export const createTribeSchema = z.object({
  name: z.string().min(1).max(100),
  tribeName: z.string().max(200).optional().default(''),
  description: z.string().default(''),
  domainId: z.string().uuid(),
  subdomainId: z.union([z.string().uuid(), z.literal('')]).default(''),
  leadMemberId: z.union([z.string().uuid(), z.literal('')]).default(''),
  ...linksFields,
});

export const updateTribeSchema = createTribeSchema.omit({ domainId: true }).partial();
