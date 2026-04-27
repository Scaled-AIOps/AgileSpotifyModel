/**
 * Purpose: UUID v4 generator.
 * Usage:   `generateId()` is called by every service that needs to mint a new entity ID.
 * Goal:    Provide a single, easy-to-mock seam for ID generation across the codebase.
 * ToDo:    —
 */
import { v4 as uuidv4 } from 'uuid';

export const generateId = (): string => uuidv4();
