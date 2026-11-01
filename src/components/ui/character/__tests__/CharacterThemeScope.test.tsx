import { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CharacterThemeScope } from '../CharacterThemeScope';
import {
  clearCharacterThemeScope,
  registerCharacterThemeScope,
} from '@/hooks/useTheme';
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CharacterState } from '@/types/character';

const hydration = vi.hoisted(() => ({ ready: true }));

vi.mock('@/hooks/useTheme', () => ({
  registerCharacterThemeScope: vi.fn(),
  clearCharacterThemeScope: vi.fn(),
}));
vi.mock('@/hooks/useHydration', () => ({
  useHydration: () => hydration.ready,
}));
beforeEach(() => {
  vi.clearAllMocks();
  hydration.ready = true;
});
afterEach(cleanup);
it('only applies the loaded route character and restores app scope on exit', () => {
  useCharacterStore.setState({
    character: makeCharacter({ id: 'one', themePreference: 'blue' }),
  });
  const { rerender, unmount } = render(
    <StrictMode>
      <CharacterThemeScope characterId="one">Sheet</CharacterThemeScope>
    </StrictMode>
  );
  expect(registerCharacterThemeScope).toHaveBeenLastCalledWith(
    expect.any(Object),
    'one',
    'blue'
  );
  rerender(
    <StrictMode>
      <CharacterThemeScope characterId="two">Settings</CharacterThemeScope>
    </StrictMode>
  );
  expect(registerCharacterThemeScope).toHaveBeenLastCalledWith(
    expect.any(Object),
    'two',
    undefined
  );
  act(() =>
    useCharacterStore.setState({
      character: makeCharacter({ id: 'two', themePreference: 'light' }),
    })
  );
  expect(registerCharacterThemeScope).toHaveBeenLastCalledWith(
    expect.any(Object),
    'two',
    'light'
  );
  unmount();
  expect(clearCharacterThemeScope).toHaveBeenLastCalledWith(
    vi.mocked(registerCharacterThemeScope).mock.lastCall![0]
  );
});

it('follows the app until hydration and safely handles an unsupported saved preference', () => {
  hydration.ready = false;
  useCharacterStore.setState({
    character: makeCharacter({ id: 'one', themePreference: 'blue' }),
  });
  const { rerender } = render(
    <CharacterThemeScope characterId="one">Sheet</CharacterThemeScope>
  );
  expect(registerCharacterThemeScope).toHaveBeenLastCalledWith(
    expect.any(Object),
    'one',
    undefined
  );
  hydration.ready = true;
  rerender(<CharacterThemeScope characterId="one">Sheet</CharacterThemeScope>);
  expect(registerCharacterThemeScope).toHaveBeenLastCalledWith(
    expect.any(Object),
    'one',
    'blue'
  );
  act(() =>
    useCharacterStore.setState({
      character: {
        ...makeCharacter({ id: 'one' }),
        themePreference: 'sepia',
      } as unknown as CharacterState,
    })
  );
  expect(registerCharacterThemeScope).toHaveBeenLastCalledWith(
    expect.any(Object),
    'one',
    undefined
  );
});
