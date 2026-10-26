import { describe, expect, it } from 'vitest';
import { getHpCardClasses } from '../DockVitals.utils';

describe('getHpCardClasses', () => {
  it('tints the HP card by the shared tiers, thresholds inclusive', () => {
    const healthy = getHpCardClasses(100);
    const bloodied = getHpCardClasses(60);
    const critical = getHpCardClasses(20);
    expect(getHpCardClasses(75)).toBe(healthy);
    expect(getHpCardClasses(74)).toBe(bloodied);
    expect(getHpCardClasses(25)).toBe(bloodied);
    expect(getHpCardClasses(24)).toBe(critical);
    expect(getHpCardClasses(0)).toBe(critical);
    expect(new Set([healthy, bloodied, critical]).size).toBe(3);
  });
});
