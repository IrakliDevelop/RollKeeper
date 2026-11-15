'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';
import {
  calculateCharacterArmorClass,
  formatModifier,
} from '@/utils/calculations';

import { AcEditDialog } from './AcEditDialog';
import { useHpAmountEditor } from './useHpAmountEditor';
import { QuickCombatStrip } from './QuickCombatStrip';
import { HpCard } from './HpCard';

export interface DockVitalsProps {
  addToast: (toast: Omit<ToastData, 'id'>) => void;
}

export function DockVitals({ addToast }: DockVitalsProps) {
  const {
    character,
    addHeroicInspiration,
    updateHeroicInspiration,
    useHeroicInspiration: spendHeroicInspiration,
    toggleReaction,
  } = useCharacterStore();
  const hpEditor = useHpAmountEditor(addToast);
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

  const { count: heroicCount, maxCount } = character.heroicInspiration;
  const stackable = character.stackableInspiration ?? false;
  const effectiveHeroicMax = stackable
    ? (maxCount ?? Number.POSITIVE_INFINITY)
    : 1;
  const hasUsedReaction = character.reaction?.hasUsedReaction ?? false;

  const handleUseHeroic = () => {
    spendHeroicInspiration();
    const r1 = 1 + Math.floor(Math.random() * 20);
    const r2 = 1 + Math.floor(Math.random() * 20);
    addToast({
      type: 'info',
      title: `Heroic inspiration: ${Math.max(r1, r2)}`,
      message: `(rolled ${r1} & ${r2}, advantage)`,
    });
  };

  return (
    <div className="space-y-3">
      <HpCard
        hpCurrent={hpCurrent}
        hpMax={hpMax}
        hpTemp={hpTemp}
        hpPercent={hpPercent}
        amount={hpEditor.amount}
        onAmountChange={hpEditor.setAmount}
        onDamage={hpEditor.onDamage}
        onHeal={hpEditor.onHeal}
        onTemp={hpEditor.onTemp}
      />

      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Edit armor class"
            onClick={() => setAcOpen(true)}
            className="h-auto w-full flex-col items-start gap-0 px-2 py-1 text-left"
          >
            <span className="type-num-lg text-heading block tabular-nums">
              {totalAC}
            </span>
            <span className="type-small text-muted flex items-center gap-1">
              AC
              <Pencil size={12} aria-hidden />
            </span>
          </Button>
        </div>
        <div className="px-2 py-1">
          <span className="type-num-lg text-heading block tabular-nums">
            {formatModifier(initiativeModifier)}
          </span>
          <span className="type-small text-muted block">Init</span>
        </div>
      </div>
      <AcEditDialog open={acOpen} onOpenChange={setAcOpen} />

      <QuickCombatStrip
        hasUsedReaction={hasUsedReaction}
        onToggleReaction={toggleReaction}
        count={heroicCount}
        maxCount={effectiveHeroicMax}
        stackable={stackable}
        onUse={handleUseHeroic}
        onIncrement={() => addHeroicInspiration(1)}
        onDecrement={() =>
          updateHeroicInspiration({ count: Math.max(0, heroicCount - 1) })
        }
      />
    </div>
  );
}
