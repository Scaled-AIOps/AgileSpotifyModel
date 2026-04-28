/**
 * Purpose: Zod schemas for auth endpoints (register, login, change-passcode).
 * Usage:   Imported by auth.routes.ts and passed to the `validate(...)` middleware.
 * Goal:    Centralise passcode complexity (≥8 chars, uppercase, digit) and email format rules so all auth routes share them.
 * ToDo:    Bump passcode min length to 12 and add a special-char requirement.
 */
import { z } from 'zod';

const strongPasscode = z.string()
  .min(8, 'Passcode must be at least 8 characters')
  .regex(/[A-Z]/, 'Passcode must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Passcode must contain at least one number');

export const registerSchema = z.object({
  email: z.string().email(),
  passcode: strongPasscode,
  name: z.string().min(1),
  role: z.enum(['Admin', 'TribeLead', 'PO', 'AgileCoach', 'ReleaseManager', 'Member']).default('Member'),
});

export const loginSchema = z.object({
  email: z.string().email(),
  passcode: z.string().min(1),
});

export const changePasscodeSchema = z.object({
  currentPasscode: z.string().min(1),
  newPasscode: strongPasscode,
});
