import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isFogOfWarEnabled,
  isProceduralFogAppearanceEnabled,
} from './fogOfWar';

describe('fog feature flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps both fog capabilities disabled by default', () => {
    vi.stubEnv('NEXT_PUBLIC_FOG_OF_WAR_ENABLED', '');
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', '');

    expect(isFogOfWarEnabled()).toBe(false);
    expect(isProceduralFogAppearanceEnabled()).toBe(false);
  });

  it('enables procedural appearance only through its own exact flag', () => {
    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'true');
    expect(isProceduralFogAppearanceEnabled()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_PROCEDURAL_FOG_ENABLED', 'TRUE');
    expect(isProceduralFogAppearanceEnabled()).toBe(false);
  });
});
