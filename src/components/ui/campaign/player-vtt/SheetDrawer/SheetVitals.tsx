'use client';

import { useMemo } from 'react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';
import { formatModifier } from '@/utils/calculations';

import { useHpAmountEditor } from '../CharacterDock/useHpAmountEditor';
import { HpCard } from '../CharacterDock/HpCard';
import { MaybeRollElement } from './MaybeRollElement';
import { buildVitalsView } from './SheetDrawer.utils';

export interface SheetVitalsProps {
  addToast: (t: Omit<ToastData, 'id'>) => void;
  roll?: (label: string, modifier: number) => Promise<void>;
}

// dt first keeps the markup a valid definition list; flex-col-reverse shows
// the value above its label.
const CELL_CLASS = 'flex flex-col-reverse';
const LABEL_CLASS = 'type-small text-muted';
const VALUE_CLASS = 'type-num-lg text-heading tabular-nums';

export function SheetVitals({ addToast, roll }: SheetVitalsProps) {
  const character = useCharacterStore(s => s.character);
  const view = useMemo(() => buildVitalsView(character), [character]);
  const hpEditor = useHpAmountEditor(addToast);

  return (
    <div className="space-y-3">
      <HpCard
        hpCurrent={view.hpCurrent}
        hpMax={view.hpMax}
        hpTemp={view.hpTemp}
        hpPercent={view.hpPercent}
        amount={hpEditor.amount}
        onAmountChange={hpEditor.setAmount}
        onDamage={hpEditor.onDamage}
        onHeal={hpEditor.onHeal}
        onTemp={hpEditor.onTemp}
      />
      <dl className="grid grid-cols-4 gap-x-3">
        <div className={CELL_CLASS}>
          <dt className={LABEL_CLASS}>AC</dt>
          <dd className={VALUE_CLASS}>{view.ac}</dd>
        </div>
        <MaybeRollElement
          ariaLabel="Roll initiative"
          className={`${CELL_CLASS} text-left`}
          onRoll={roll ? () => roll('Initiative', view.initiative) : undefined}
        >
          <dt className={LABEL_CLASS}>Init</dt>
          <dd className={VALUE_CLASS}>{formatModifier(view.initiative)}</dd>
        </MaybeRollElement>
        <div className={CELL_CLASS}>
          <dt className={LABEL_CLASS}>Speed</dt>
          <dd className={VALUE_CLASS}>{view.speed} ft</dd>
        </div>
        <div className={CELL_CLASS}>
          <dt className={LABEL_CLASS}>Prof</dt>
          <dd className={VALUE_CLASS}>
            {formatModifier(view.proficiencyBonus)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
