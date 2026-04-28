import { describe, it, expect } from 'vitest';
import { hashKentwort, compareKentwort } from '../../lib/crypto';

describe('hashKentwort', () => {
  it('produces a bcrypt hash', async () => {
    const hash = await hashKentwort('MyP@ssw0rd');
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('produces a different hash each time (salt)', async () => {
    const [h1, h2] = await Promise.all([hashKentwort('same'), hashKentwort('same')]);
    expect(h1).not.toBe(h2);
  });
});

describe('compareKentwort', () => {
  it('returns true for matching kentwort', async () => {
    const hash = await hashKentwort('correct');
    expect(await compareKentwort('correct', hash)).toBe(true);
  });

  it('returns false for wrong kentwort', async () => {
    const hash = await hashKentwort('correct');
    expect(await compareKentwort('wrong', hash)).toBe(false);
  });
});
