import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../../lib/crypto';

describe('hashPassword', () => {
  it('produces a bcrypt hash', async () => {
    const hash = await hashPassword('MyP@ssw0rd');
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('produces a different hash each time (salt)', async () => {
    const [h1, h2] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(h1).not.toBe(h2);
  });
});

describe('comparePassword', () => {
  it('returns true for matching password', async () => {
    const hash = await hashPassword('correct');
    expect(await comparePassword('correct', hash)).toBe(true);
  });

  it('returns false for wrong password', async () => {
    const hash = await hashPassword('correct');
    expect(await comparePassword('wrong', hash)).toBe(false);
  });
});
