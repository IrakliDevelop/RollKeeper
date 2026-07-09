'use client';

import { useState } from 'react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';
import {
  calculateCharacterArmorClass,
  formatModifier,
} from '@/utils/calculations';

import { AcEditDialog } from './AcEditDialog';
import { parseHpAmount } from './DockVitals.utils';
import { HeroicInspirationRow } from './HeroicInspirationRow';
import { HpCard } from './HpCard';

export interface DockVitalsProps {
  addToast: (toast: Omit<ToastData, 'id'>) => void;
}

export function DockVitals({ addToast }: DockVitalsProps) {
  const {
    character,
    applyDamageToCharacter,
    applyHealingToCharacter,
    addTemporaryHPToCharacter,
    addHeroicInspiration,
    updateHeroicInspiration,
    useHeroicInspiration: spendHeroicInspiration,
  } = useCharacterStore();
  const [amount, setAmount] = useState('');
  const [acOpen, setAcOpen] = useState(false);

  const {
    current: hpCurrent,
    max: hpMax,
    temporary: hpTemp,
  } = character.hitPoints;
  const hpPercent = hpMax > 0 ? (hpCurrent / hpMax) * 100 : 0;

  const totalAC = calculateCharacterArmorClass(character);
  const initiativeModifier = character.initiative.isOverridden
    ? character.initiative.value
    : Math.floor((character.abilities.dexterity - 10) / 2);

  const { count: heroicCount, maxCount: heroicMax } =
    character.heroicInspiration;

  const applyAmount = (
    apply: (n: number) => void,
    toastTitle: (n: number) => string
  ) => {
    const n = parseHpAmount(amount);
    if (n === null) return;
    apply(n);
    setAmount('');
    // Read the post-apply state back so the toast reflects the actual
    // result (temp-first damage, heal capping at max, etc.) rather than
    // just echoing the typed amount.
    const { current, max, temporary } =
      useCharacterStore.getState().character.hitPoints;
    const message = `HP ${current}/${max}${temporary > 0 ? ` +${temporary} temp` : ''}`;
    addToast({ type: 'info', title: toastTitle(n), message });
  };

  const handleApplyDamage = () =>
    applyAmount(applyDamageToCharacter, n => `Took ${n} damage`);
  const handleApplyHeal = () =>
    applyAmount(applyHealingToCharacter, n => `Healed ${n} HP`);
  const handleApplyTemp = () =>
    applyAmount(addTemporaryHPToCharacter, n => `+${n} temp HP`);

  const handleUseHeroic = () => {
    spendHeroicInspiration();
    const r1 = 1 + Math.floor(Math.random() * 20);
    const r2 = 1 + Math.floor(Math.random() * 20);
    addToast({
      type: 'info',
      title: `Heroic Inspiration: ${Math.max(r1, r2)}`,
      message: `(rolled ${r1} & ${r2}, advantage)`,
    });
  };

  return (
    <div className="space-y-2">
      <HpCard
        hpCurrent={hpCurrent}
        hpMax={hpMax}
        hpTemp={hpTemp}
        hpPercent={hpPercent}
        amount={amount}
        onAmountChange={setAmount}
        onDamage={handleApplyDamage}
        onHeal={handleApplyHeal}
        onTemp={handleApplyTemp}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setAcOpen(true)}
          title="Edit armor class"
          aria-label="Edit armor class"
          className="border-divider hover:bg-surface-secondary min-h-[44px] rounded-lg border p-2 text-center"
        >
          <div className="text-heading text-xl font-bold">{totalAC}</div>
          <div className="text-faint text-xs uppercase">AC ✎</div>
        </button>
        <div className="border-divider rounded-lg border p-2 text-center">
          <div className="text-heading text-xl font-bold">
            {formatModifier(initiativeModifier)}
          </div>
          <div className="text-faint text-xs uppercase">Init</div>
        </div>
      </div>
      <AcEditDialog open={acOpen} onOpenChange={setAcOpen} />

      <HeroicInspirationRow
        count={heroicCount}
        maxCount={heroicMax}
        onIncrement={() => addHeroicInspiration(1)}
        onDecrement={() =>
          updateHeroicInspiration({ count: Math.max(0, heroicCount - 1) })
        }
        onUse={handleUseHeroic}
      />
    </div>
  );
}
