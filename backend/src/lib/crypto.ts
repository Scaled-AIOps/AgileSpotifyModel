/**
 * Purpose: bcrypt passcode helpers.
 * Usage:   `hashPasscode(plain)` and `comparePasscode(plain, hash)` are used by auth.service for register / login / change-passcode flows.
 * Goal:    Encapsulate the bcrypt cost factor and async API in one place so future algorithm changes touch a single file.
 * ToDo:    —
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const hashPasscode = (passcode: string): Promise<string> =>
  bcrypt.hash(passcode, SALT_ROUNDS);

export const comparePasscode = (passcode: string, hash: string): Promise<boolean> =>
  bcrypt.compare(passcode, hash);
