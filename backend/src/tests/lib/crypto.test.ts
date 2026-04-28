import { describe, it, expect } from 'vitest';
import { hashPasscode, comparePasscode } from '../../lib/crypto';

describe('hashPasscode', () => {
  it('produces a bcrypt hash', async () => {
    const hash = await hashPasscode('MyP@ssw0rd');
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('produces a different hash each time (salt)', async () => {
    const [h1, h2] = await Promise.all([hashPasscode('same'), hashPasscode('same')]);
    expect(h1).not.toBe(h2);
  });
});

describe('comparePasscode', () => {
  it('returns true for matching passcode', async () => {
    const hash = await hashPasscode('correct');
    expect(await comparePasscode('correct', hash)).toBe(true);
  });

  it('returns false for wrong passcode', async () => {
    const hash = await hashPasscode('correct');
    expect(await comparePasscode('wrong', hash)).toBe(false);
  });
});
