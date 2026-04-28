/**
 * Purpose: Zod schemas for Member create / update.
 * Usage:   Imported by member.routes.ts and (for signet) by auth.routes.ts on self-registration.
 * Goal:    Validate member inputs at the API boundary.
 * ToDo:    —
 */
import { z } from 'zod';

export const createMemberSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  signet: z.string().min(8).optional(),
  role: z.enum(['Admin', 'TribeLead', 'PO', 'AgileCoach', 'ReleaseManager', 'Member']).default('Member'),
  avatarUrl: z.string().default(''),
  squadId: z.string().optional().default(''),
});

export const updateMemberSchema = createMemberSchema.omit({ signet: true }).partial();
