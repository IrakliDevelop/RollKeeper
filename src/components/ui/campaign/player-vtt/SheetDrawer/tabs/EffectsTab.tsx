'use client';

import { useMemo } from 'react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';

import { DockBuffs } from '../../CharacterDock/DockBuffs';
import { EffectsConcentration } from './EffectsConcentration';

import { useCharacterStore } from '@/store/characterStore';
import { useExhaustionStepper } from '@/hooks/useExhaustionStepper';

import { buildConditionToggles, exhaustionRulesText } from '../SheetTabs.utils';

import type { SheetRoll } from '../SheetDrawer.types';

export interface EffectsTabProps {
  addToast: (t: Omit<ToastData, 'id'>) => void;
  roll?: SheetRoll;
}

const SECTION_CLASS = 'border-divider bg-surface rounded-xl border p-3';
const HEADING_CLASS = 'text-faint mb-2 text-xs font-bold uppercase';

export function EffectsTab({ addToast, roll }: EffectsTabProps) {
  const character = useCharacterStore(s => s.character);
  const addCondition = useCharacterStore(s => s.addCondition);
  const removeCondition = useCharacterStore(s => s.removeCondition);
  const stopConcentration = useCharacterStore(s => s.stopConcentration);
  const toggleBuff = useCharacterStore(s => s.toggleBuff);
  const exhaustion = useExhaustionStepper();

  const conditionToggles = useMemo(
    () => buildConditionToggles(character),
    [character]
  );
  const buffs = character.temporaryBuffs ?? [];

  const handleToggleBuff = (id: string) => {
    const buff = buffs.find(b => b.id === id);
    toggleBuff(id);
    if (buff) {
      addToast({
        type: 'info',
        title: `${buff.name} ${buff.isActive ? 'off' : 'on'}`,
        message: '',
      });
    }
  };

  return (
    <div className="space-y-3">
      <EffectsConcentration
        character={character}
        roll={roll}
        onEndConcentration={stopConcentration}
      />

      {buffs.length > 0 && (
        <div className={SECTION_CLASS}>
          <DockBuffs buffs={buffs} onToggleBuff={handleToggleBuff} />
        </div>
      )}

      <div className={SECTION_CLASS}>
        <div className={HEADING_CLASS}>Conditions</div>
        <div className="grid grid-cols-3 gap-2">
          {conditionToggles.map(toggle => (
            <Button
              key={toggle.name}
              type="button"
              variant={toggle.activeId ? 'danger' : 'outline'}
              size="sm"
              aria-pressed={!!toggle.activeId}
              onClick={() =>
                toggle.activeId
                  ? removeCondition(toggle.activeId)
                  : addCondition(
                      toggle.name,
                      'Self',
                      '',
                      1,
                      undefined,
                      undefined,
                      'debuff'
                    )
              }
            >
              {toggle.name}
            </Button>
          ))}
        </div>
        <p className="text-faint mt-2 text-[10px]">Also shows on your token.</p>
      </div>

      <div className={SECTION_CLASS}>
        <div className={HEADING_CLASS}>Exhaustion</div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Decrease exhaustion"
            disabled={exhaustion.level === 0}
            onClick={() => exhaustion.decrement()}
          >
            −
          </Button>
          <span className="text-heading min-w-[1.5rem] text-center text-lg font-bold">
            {exhaustion.level}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label="Increase exhaustion"
            disabled={exhaustion.level >= 6}
            onClick={() => void exhaustion.increment()}
          >
            +
          </Button>
          <span className="text-muted text-xs">/ 6</span>
        </div>
        <p className="text-muted mt-2 text-xs">
          {exhaustionRulesText(exhaustion.level, exhaustion.variant)}
        </p>
      </div>
    </div>
  );
}
