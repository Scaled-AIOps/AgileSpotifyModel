/**
 * Purpose: bcrypt signet helpers.
 * Usage:   `hashSignet(plain)` and `compareSignet(plain, hash)` are used by auth.service for register / login / change-signet flows.
 * Goal:    Encapsulate the bcrypt cost factor and async API in one place so future algorithm changes touch a single file.
 * ToDo:    —
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashSignet = (signet: string): Promise<string> =>
  bcrypt.hash(signet, SALT_ROUNDS);

export const compareSignet = (signet: string, hash: string): Promise<boolean> =>
  bcrypt.compare(signet, hash);
