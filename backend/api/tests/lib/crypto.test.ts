import { describe, it, expect } from 'vitest';
import { hashSignet, compareSignet } from '../../lib/crypto';

describe('hashSignet', () => {
  it('produces a bcrypt hash', async () => {
    const hash = await hashSignet('MyP@ssw0rd');
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it('produces a different hash each time (salt)', async () => {
    const [h1, h2] = await Promise.all([hashSignet('same'), hashSignet('same')]);
    expect(h1).not.toBe(h2);
  });
});

describe('compareSignet', () => {
  it('returns true for matching signet', async () => {
    const hash = await hashSignet('correct');
    expect(await compareSignet('correct', hash)).toBe(true);
  });

  it('returns false for wrong signet', async () => {
    const hash = await hashSignet('correct');
    expect(await compareSignet('wrong', hash)).toBe(false);
  });
});
