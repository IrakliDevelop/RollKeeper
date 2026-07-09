'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';
import {
  calculateCharacterArmorClass,
  formatModifier,
} from '@/utils/calculations';
import { getHpBarColor } from '@/utils/hpColor';

import { getHpCardClasses, parseHpAmount } from './DockVitals.utils';
import { HeroicInspirationRow } from './HeroicInspirationRow';

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
    <div className="space-y-3">
      <div className={`rounded-xl border p-4 ${getHpCardClasses(hpPercent)}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-heading text-3xl font-bold">
            {hpCurrent}/{hpMax}
          </span>
          {hpTemp > 0 && <Badge variant="info">+{hpTemp} temp</Badge>}
        </div>
        <div className="bg-surface-secondary mt-2 h-2 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${getHpBarColor(hpCurrent, hpMax)}`}
            style={{ width: `${Math.min(100, Math.max(0, hpPercent))}%` }}
          />
        </div>
      </div>

      {/* Fixed input column + three equal flexible buttons: everything always
          fits the dock's width — a plain flex row clipped the Temp button. */}
      <div className="grid grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] items-center gap-1.5">
        <Input
          aria-label="HP amount"
          inputMode="numeric"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full min-w-0"
        />
        <Button
          variant="danger"
          size="lg"
          className="min-w-0 px-1 text-xs"
          onClick={handleApplyDamage}
        >
          Damage
        </Button>
        <Button
          variant="success"
          size="lg"
          className="min-w-0 px-1 text-xs"
          onClick={handleApplyHeal}
        >
          Heal
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="min-w-0 px-1 text-xs"
          onClick={handleApplyTemp}
        >
          Temp
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="border-divider rounded-lg border p-3 text-center">
          <div className="text-heading text-xl font-bold">{totalAC}</div>
          <div className="text-faint text-xs uppercase">AC</div>
        </div>
        <div className="border-divider rounded-lg border p-3 text-center">
          <div className="text-heading text-xl font-bold">
            {formatModifier(initiativeModifier)}
          </div>
          <div className="text-faint text-xs uppercase">Init</div>
        </div>
      </div>

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
