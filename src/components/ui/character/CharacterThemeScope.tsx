'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  clearCharacterThemeScope,
  registerCharacterThemeScope,
} from '@/hooks/useTheme';
import { useHydration } from '@/hooks/useHydration';
import { useCharacterStore } from '@/store/characterStore';
import { parseThemePreference } from '@/utils/themePreference';

/** The route owns scope; pages continue to own character loading and saving. */
export function CharacterThemeScope({
  characterId,
  children,
}: {
  characterId: string;
  children: ReactNode;
}) {
  const owner = useRef({});
  const hydrated = useHydration();
  const liveId = useCharacterStore(state => state.character.id);
  const preference = useCharacterStore(
    state => state.character.themePreference
  );
  const theme =
    hydrated && liveId === characterId
      ? parseThemePreference(preference)
      : undefined;
  useLayoutEffect(() => {
    const token = owner.current;
    registerCharacterThemeScope(token, characterId, theme);
    return () => clearCharacterThemeScope(token);
  }, [characterId, theme]);
  return children;
}
