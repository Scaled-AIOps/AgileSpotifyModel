/**
 * Purpose: Zod schemas for auth endpoints (register, login, change-signet).
 * Usage:   Imported by auth.routes.ts and passed to the `validate(...)` middleware.
 * Goal:    Centralise signet complexity (≥8 chars, uppercase, digit) and email format rules so all auth routes share them.
 * ToDo:    Bump signet min length to 12 and add a special-char requirement.
 */
import { z } from 'zod';

const strongSignet = z.string()
  .min(8, 'Signet must be at least 8 characters')
  .regex(/[A-Z]/, 'Signet must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Signet must contain at least one number');

export const registerSchema = z.object({
  email: z.string().email(),
  signet: strongSignet,
  name: z.string().min(1),
  role: z.enum(['Admin', 'TribeLead', 'PO', 'AgileCoach', 'ReleaseManager', 'Member']).default('Member'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  signet: z.string().min(1),
});

export const changeSignetSchema = z.object({
  currentSignet: z.string().min(1),
  newSignet: strongSignet,
});
