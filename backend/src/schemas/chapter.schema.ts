/**
 * Purpose: Zod schemas for Chapter create / update.
 * Usage:   Imported by chapter.routes.ts.
 * Goal:    Validate chapter inputs (name, description, discipline, tribe FK, lead).
 * ToDo:    —
 */
import { z } from 'zod';

export const createChapterSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(''),
  discipline: z.string().default(''),
  tribeId: z.string().uuid(),
  leadMemberId: z.union([z.string().uuid(), z.literal('')]).default(''),
});

export const updateChapterSchema = createChapterSchema.omit({ tribeId: true }).partial();
