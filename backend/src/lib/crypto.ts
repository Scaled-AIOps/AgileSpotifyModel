/**
 * Purpose: bcrypt kentwort helpers.
 * Usage:   `hashKentwort(plain)` and `compareKentwort(plain, hash)` are used by auth.service for register / login / change-kentwort flows.
 * Goal:    Encapsulate the bcrypt cost factor and async API in one place so future algorithm changes touch a single file.
 * ToDo:    —
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashKentwort = (kentwort: string): Promise<string> =>
  bcrypt.hash(kentwort, SALT_ROUNDS);

export const compareKentwort = (kentwort: string, hash: string): Promise<boolean> =>
  bcrypt.compare(kentwort, hash);
