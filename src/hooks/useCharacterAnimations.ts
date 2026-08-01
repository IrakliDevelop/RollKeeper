'use client';

import { useEffect, useRef } from 'react';

import { useCharacterStore } from '@/store/characterStore';
import { usePlayerStore } from '@/store/playerStore';
import { isDead } from '@/utils/hpCalculations';
import { getCharacterTotalLevel } from '@/utils/calculations';

/**
 * Renders death / level-up animations from STATE TRANSITIONS instead of
 * action side effects. Under single-writer sync, mutations execute on the
 * leader tab — deriving from adopted state means every tab holding the
 * character (including the follower that pressed the button) sees the
 * animation. Mount once wherever the animations render (the sheet page).
 */
export function useCharacterAnimations(): void {
  const hitPoints = useCharacterStore(s => s.character.hitPoints);
  const character = useCharacterStore(s => s.character);
  const triggerDeathAnimation = useCharacterStore(s => s.triggerDeathAnimation);
  const triggerLevelUpAnimation = useCharacterStore(
    s => s.triggerLevelUpAnimation
  );

  const wasDeadRef = useRef<boolean | null>(null);
  const lastLevelRef = useRef<number | null>(null);
  const lastCharacterIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Reset baselines on character switch — never fire on first observation.
    if (lastCharacterIdRef.current !== character.id) {
      lastCharacterIdRef.current = character.id;
      wasDeadRef.current = isDead(hitPoints);
      lastLevelRef.current = getCharacterTotalLevel(character);
      return;
    }

    const dead = isDead(hitPoints);
    if (wasDeadRef.current === false && dead) {
      const settings = usePlayerStore.getState().settings;
      if (settings.enableDeathAnimation) triggerDeathAnimation();
    }
    wasDeadRef.current = dead;

    const level = getCharacterTotalLevel(character);
    if (lastLevelRef.current !== null && level > lastLevelRef.current) {
      const settings = usePlayerStore.getState().settings;
      if (settings.enableLevelUpAnimation) triggerLevelUpAnimation(level);
    }
    lastLevelRef.current = level;
  }, [hitPoints, character, triggerDeathAnimation, triggerLevelUpAnimation]);
}
