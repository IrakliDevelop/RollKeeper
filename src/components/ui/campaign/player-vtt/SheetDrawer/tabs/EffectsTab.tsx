'use client';

import { useMemo } from 'react';

import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

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
    <div className="space-y-6">
      <EffectsConcentration
        character={character}
        roll={roll}
        onEndConcentration={stopConcentration}
      />

      {buffs.length > 0 && (
        <DockBuffs buffs={buffs} onToggleBuff={handleToggleBuff} />
      )}

      <Section heading="Conditions" level={4}>
        <div className="grid grid-cols-3 gap-2">
          {conditionToggles.map(toggle => (
            <Button
              key={toggle.name}
              type="button"
              variant="outline"
              selected={!!toggle.activeId}
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
        <p className="type-caption text-muted mt-2">
          Also shows on your token.
        </p>
      </Section>

      <EffectsOtherList effects={otherEffects} onRemove={removeCondition} />

      <Section heading="Exhaustion" level={4}>
        <div className="flex items-center gap-3">
          <Tooltip content="Decrease exhaustion">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-9 px-0"
              aria-label="Decrease exhaustion"
              disabled={exhaustion.level === 0}
              onClick={() => exhaustion.decrement()}
            >
              <Minus size={16} aria-hidden />
            </Button>
          </Tooltip>
          <span className="type-num-lg text-heading min-w-6 text-center">
            {exhaustion.level}
          </span>
          <Tooltip content="Increase exhaustion">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-9 px-0"
              aria-label="Increase exhaustion"
              disabled={exhaustion.level >= 6}
              onClick={() => void exhaustion.increment()}
            >
              <Plus size={16} aria-hidden />
            </Button>
          </Tooltip>
          <span className="type-small text-muted">/ 6</span>
        </div>
        <p className="type-small text-muted mt-2">
          {exhaustionRulesText(exhaustion.level, exhaustion.variant)}
        </p>
      </Section>
    </div>
  );
}
