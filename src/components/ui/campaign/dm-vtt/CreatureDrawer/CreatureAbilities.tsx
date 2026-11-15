'use client';

import React from 'react';

import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { ProficiencyDot } from '@/components/ui/game/ProficiencyDot';
import { Section } from '@/components/ui/layout/section';
import {
  ABILITY_KEYS,
  abilitySaveValue,
  computeSaveProficiencies,
  resetSavePatch,
  saveProficiencyPatch,
  signedModifier,
  type AbilityKey,
} from '@/components/ui/encounter/combat-screen/detail/DetailAbilityScores.utils';
import { cn } from '@/utils/cn';

import type { CreatureVitalsProps } from './CreatureDrawer.utils';

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: 'STR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'WIS',
  cha: 'CHA',
};

function SaveFooter({
  proficient,
  save,
}: {
  proficient: boolean;
  save: string;
}) {
  return (
    <>
      <ProficiencyDot level={proficient ? 'proficient' : 'none'} decorative />
      <span
        className={cn(
          'type-small',
          proficient ? 'text-brass-text' : 'text-muted'
        )}
      >
        {save}
      </span>
    </>
  );
}

/** "Ability scores" section — scores, modifiers, and save proficiency/overrides. */
export function CreatureAbilities({
  entity,
  actions,
  editing,
}: CreatureVitalsProps) {
  const sb = entity.monsterStatBlock;
  if (!sb) return null;

  const { proficiencies, saveByAbility } = computeSaveProficiencies(sb);

  const handleScoreChange = (key: AbilityKey, value: number | undefined) => {
    if (value === undefined) return;
    actions.onUpdate(entity.id, {
      monsterStatBlock: { ...sb, [key]: value },
    });
  };

  const toggleProficiency = (key: AbilityKey, proficient: boolean) => {
    actions.onUpdate(entity.id, {
      monsterStatBlock: saveProficiencyPatch(
        sb,
        proficiencies,
        key,
        proficient
      ),
    });
  };

  const resetSave = (key: AbilityKey) => {
    actions.onUpdate(entity.id, {
      monsterStatBlock: resetSavePatch(sb, proficiencies, key),
    });
  };

  return (
    <Section level={4} heading="Ability scores">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ABILITY_KEYS.map(key => {
          const label = ABILITY_LABELS[key];
          const score = sb[key];
          const proficient = proficiencies.includes(key);
          const override = saveByAbility[key];
          const save = abilitySaveValue(
            sb,
            key,
            proficiencies,
            saveByAbility,
            entity.proficiencyBonus
          );

          return (
            <div
              key={key}
              className="flex flex-col items-center gap-0.5 text-center"
            >
              <span className="type-small text-muted">{label}</span>
              <span className="type-num-md text-heading tabular-nums">
                {signedModifier(score)}
              </span>
              {editing ? (
                <NumberInput
                  size="sm"
                  value={score}
                  onChange={v => handleScoreChange(key, v)}
                  wrapperClassName="w-full"
                  className="px-1 text-center tabular-nums"
                  aria-label={`${label} score`}
                />
              ) : (
                <span className="type-small text-muted tabular-nums">
                  {score}
                </span>
              )}

              {editing ? (
                <Button
                  variant="ghost"
                  size="xs"
                  selected={proficient}
                  onClick={() => toggleProficiency(key, !proficient)}
                  aria-pressed={proficient}
                  aria-label={`${label} save proficiency`}
                  className="gap-1 px-1.5"
                >
                  <SaveFooter proficient={proficient} save={save} />
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <SaveFooter proficient={proficient} save={save} />
                </div>
              )}

              {editing && override != null && (
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => resetSave(key)}
                  aria-label={`Reset ${label} saving throw`}
                >
                  Reset
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
