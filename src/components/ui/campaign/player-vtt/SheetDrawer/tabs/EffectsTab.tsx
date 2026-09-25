'use client';

import { useMemo } from 'react';

import { Button } from '@/components/ui/forms/button';

import { DockBuffs } from '../../CharacterDock/DockBuffs';
import { EffectsConcentration } from './EffectsConcentration';
import { EffectsOtherList } from './EffectsOtherList';

import { useExhaustionStepper } from '@/hooks/useExhaustionStepper';
import { useCharacterStore } from '@/store/characterStore';

import {
  buildConditionToggles,
  buildOtherEffects,
  exhaustionRulesText,
} from '../SheetTabs.utils';

import type { ToastData } from '@/components/ui/feedback/Toast';
import type { SheetRoll } from '../SheetDrawer.types';

import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';

export interface EffectsTabProps {
  addToast: (t: Omit<ToastData, 'id'>) => void;
  roll?: SheetRoll;
}

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
  const otherEffects = useMemo(() => buildOtherEffects(character), [character]);
  const buffs = character.temporaryBuffs ?? [];

  const handleToggleCondition = (name: string, activeId: string | null) => {
    if (activeId) {
      removeCondition(activeId);
      return;
    }
    // Re-check live state: a double tap fires twice before React re-renders,
    // and the second click's snapshot would still read "inactive".
    const alreadyActive = (
      useCharacterStore.getState().character.conditionsAndDiseases
        ?.activeConditions ?? []
    ).some(a => a.name.toLowerCase() === name.toLowerCase());
    if (alreadyActive) return;
    addCondition(name, 'Self', '', 1, undefined, undefined, 'debuff');
  };

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
        <h3 className={HEADING_CLASS}>Conditions</h3>
        <div className="grid grid-cols-3 gap-2">
          {conditionToggles.map(toggle => (
            <Button
              key={toggle.name}
              type="button"
              variant={toggle.activeId ? 'danger' : 'outline'}
              size="sm"
              aria-pressed={!!toggle.activeId}
              onClick={() =>
                handleToggleCondition(toggle.name, toggle.activeId)
              }
            >
              {toggle.name}
            </Button>
          ))}
        </div>
        <p className="text-faint mt-2 text-[10px]">Also shows on your token.</p>
      </div>

      <EffectsOtherList effects={otherEffects} onRemove={removeCondition} />

      <div className={SECTION_CLASS}>
        <h3 className={HEADING_CLASS}>Exhaustion</h3>
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
