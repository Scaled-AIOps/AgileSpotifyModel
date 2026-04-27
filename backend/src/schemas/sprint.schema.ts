import { z } from 'zod';

export const createSprintSchema = z.object({
  name: z.string().min(1).max(100),
  goal: z.string().default(''),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const updateSprintSchema = createSprintSchema.partial();
