import { z } from 'zod';

export const createBacklogItemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().default(''),
  type: z.enum(['Story', 'Bug', 'Task', 'Epic']).default('Story'),
  status: z.enum(['Backlog', 'InProgress', 'Review', 'Done']).default('Backlog'),
  priority: z.number().int().min(1).max(1000).default(500),
  storyPoints: z.number().int().min(0).default(0),
  assigneeId: z.union([z.string().uuid(), z.literal('')]).default(''),
  epicId: z.union([z.string().uuid(), z.literal('')]).default(''),
});

export const updateBacklogItemSchema = createBacklogItemSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['Backlog', 'InProgress', 'Review', 'Done']),
});

export const reorderBacklogSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    priority: z.number().int().min(1).max(1000),
  })),
});
