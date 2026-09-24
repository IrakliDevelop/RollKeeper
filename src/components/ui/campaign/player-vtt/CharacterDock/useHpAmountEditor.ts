'use client';

import { useState } from 'react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';

import { parseHpAmount } from './DockVitals.utils';

/** Shared damage/heal/temp editor for the dock and the map sheet drawer. */
export function useHpAmountEditor(
  addToast: (toast: Omit<ToastData, 'id'>) => void
) {
  const applyDamageToCharacter = useCharacterStore(
    s => s.applyDamageToCharacter
  );
  const applyHealingToCharacter = useCharacterStore(
    s => s.applyHealingToCharacter
  );
  const addTemporaryHPToCharacter = useCharacterStore(
    s => s.addTemporaryHPToCharacter
  );
  const [amount, setAmount] = useState('');

  const applyAmount = (
    apply: (n: number) => void,
    toastTitle: (n: number) => string
  ) => {
    const n = parseHpAmount(amount);
    if (n === null) return;
    apply(n);
    setAmount('');
    // Read the post-apply state back so the toast reflects the actual
    // result (temp-first damage, heal capping at max, etc.).
    const { current, max, temporary } =
      useCharacterStore.getState().character.hitPoints;
    const message = `HP ${current}/${max}${temporary > 0 ? ` +${temporary} temp` : ''}`;
    addToast({ type: 'info', title: toastTitle(n), message });
  };

  return {
    amount,
    setAmount,
    onDamage: () =>
      applyAmount(applyDamageToCharacter, n => `Took ${n} damage`),
    onHeal: () => applyAmount(applyHealingToCharacter, n => `Healed ${n} HP`),
    onTemp: () => applyAmount(addTemporaryHPToCharacter, n => `+${n} temp HP`),
  };
}
