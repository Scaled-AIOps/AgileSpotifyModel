/**
 * Purpose: Zod schemas for auth endpoints (register, login, change-kentwort).
 * Usage:   Imported by auth.routes.ts and passed to the `validate(...)` middleware.
 * Goal:    Centralise kentwort complexity (≥8 chars, uppercase, digit) and email format rules so all auth routes share them.
 * ToDo:    Bump kentwort min length to 12 and add a special-char requirement.
 */
import { z } from 'zod';

const strongKentwort = z.string()
  .min(8, 'Kentwort must be at least 8 characters')
  .regex(/[A-Z]/, 'Kentwort must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Kentwort must contain at least one number');

export const registerSchema = z.object({
  email: z.string().email(),
  kentwort: strongKentwort,
  name: z.string().min(1),
  role: z.enum(['Admin', 'TribeLead', 'PO', 'AgileCoach', 'ReleaseManager', 'Member']).default('Member'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  kentwort: z.string().min(1),
});

export const changeKentwortSchema = z.object({
  currentKentwort: z.string().min(1),
  newKentwort: strongKentwort,
});
