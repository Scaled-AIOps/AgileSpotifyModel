/**
 * Purpose: Zod schemas for auth endpoints (register, login, change-password).
 * Usage:   Imported by auth.routes.ts and passed to the `validate(...)` middleware.
 * Goal:    Centralise password complexity (≥8 chars, uppercase, digit) and email format rules so all auth routes share them.
 * ToDo:    Bump password min length to 12 and add a special-char requirement.
 */
import { z } from 'zod';

const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  email: z.string().email(),
  password: strongPassword,
  name: z.string().min(1),
  role: z.enum(['Admin', 'TribeLead', 'PO', 'AgileCoach', 'ReleaseManager', 'Member']).default('Member'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});
