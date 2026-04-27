/**
 * Purpose: bcrypt password helpers.
 * Usage:   `hashPassword(plain)` and `comparePassword(plain, hash)` are used by auth.service for register / login / change-password flows.
 * Goal:    Encapsulate the bcrypt cost factor and async API in one place so future algorithm changes touch a single file.
 * ToDo:    —
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, SALT_ROUNDS);

export const comparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);
