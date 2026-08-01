import { describe, it, expect } from 'vitest';

import { isStrictlyFresher } from '@/lib/characterFreshness';

describe('isStrictlyFresher', () => {
  it('higher revision wins regardless of stamps', () => {
    expect(
      isStrictlyFresher({ revision: 2 }, { revision: 1, lastMutatedAt: 999 })
    ).toBe(true);
    expect(isStrictlyFresher({ revision: 1 }, { revision: 2 })).toBe(false);
  });

  it('equal revision falls through to lastMutatedAt', () => {
    expect(
      isStrictlyFresher(
        { revision: 3, lastMutatedAt: 200 },
        { revision: 3, lastMutatedAt: 100 }
      )
    ).toBe(true);
    expect(
      isStrictlyFresher(
        { revision: 3, lastMutatedAt: 100 },
        { revision: 3, lastMutatedAt: 200 }
      )
    ).toBe(false);
  });

  it('equal revision and timestamp falls through to lastMutatedBy', () => {
    expect(
      isStrictlyFresher(
        { revision: 3, lastMutatedAt: 100, lastMutatedBy: 'b' },
        { revision: 3, lastMutatedAt: 100, lastMutatedBy: 'a' }
      )
    ).toBe(true);
  });

  it('fully equal (including legacy stamp-less) is NOT fresher — no adopt', () => {
    expect(isStrictlyFresher({ revision: 3 }, { revision: 3 })).toBe(false);
    expect(isStrictlyFresher({}, {})).toBe(false);
  });

  it('missing fields default to 0 / empty string', () => {
    expect(
      isStrictlyFresher({ revision: 1, lastMutatedAt: 5 }, { revision: 1 })
    ).toBe(true);
    expect(
      isStrictlyFresher({ revision: 1, lastMutatedBy: 'x' }, { revision: 1 })
    ).toBe(true);
  });
});
