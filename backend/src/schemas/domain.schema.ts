import { z } from 'zod';
import { linksFields } from './links.schema';

export const createDomainSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  ...linksFields,
});

export const updateDomainSchema = createDomainSchema.partial();
