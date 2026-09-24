'use client';

import { useMemo } from 'react';
import { Shield } from 'lucide-react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';
import { formatModifier } from '@/utils/calculations';

import { useHpAmountEditor } from '../CharacterDock/useHpAmountEditor';
import { HpCard } from '../CharacterDock/HpCard';
import { buildVitalsView } from './SheetDrawer.utils';

export interface SheetVitalsProps {
  addToast: (t: Omit<ToastData, 'id'>) => void;
  roll?: (label: string, modifier: number) => Promise<void>;
}

const TILE_CLASS =
  'border-divider bg-surface rounded-lg border p-2 text-center';
const VALUE_CLASS = 'text-heading text-xl font-bold';
const LABEL_CLASS = 'text-faint text-xs uppercase';

export function SheetVitals({ addToast, roll }: SheetVitalsProps) {
  const character = useCharacterStore(s => s.character);
  const view = useMemo(() => buildVitalsView(character), [character]);
  const hpEditor = useHpAmountEditor(addToast);

  return (
    <div className="grid grid-cols-2 gap-3">
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
      <div className="grid grid-cols-2 gap-2">
        <div className={TILE_CLASS}>
          <div
            className={`${VALUE_CLASS} flex items-center justify-center gap-1`}
          >
            <Shield className="h-4 w-4" />
            {view.ac}
          </div>
          <div className={LABEL_CLASS}>AC</div>
        </div>
        {roll ? (
          <button
            type="button"
            aria-label="Roll initiative"
            onClick={() => roll('Initiative', view.initiative)}
            className={TILE_CLASS}
          >
            <div className={VALUE_CLASS}>
              {formatModifier(view.initiative)}
            </div>
            <div className={LABEL_CLASS}>Init</div>
          </button>
        ) : (
          <div className={TILE_CLASS}>
            <div className={VALUE_CLASS}>
              {formatModifier(view.initiative)}
            </div>
            <div className={LABEL_CLASS}>Init</div>
          </div>
        )}
        <div className={TILE_CLASS}>
          <div className={VALUE_CLASS}>{view.speed} ft</div>
          <div className={LABEL_CLASS}>Speed</div>
        </div>
        <div className={TILE_CLASS}>
          <div className={VALUE_CLASS}>
            {formatModifier(view.proficiencyBonus)}
          </div>
          <div className={LABEL_CLASS}>Prof</div>
        </div>
      </div>
    </div>
  );
}
