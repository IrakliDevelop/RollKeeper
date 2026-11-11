'use client';

import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Section } from '@/components/ui/layout/section';
import { abilityMod } from './npcFormDraft';
import type { AbilityKey, NpcFormDraft, NpcFormUpdate } from './npcFormDraft';

const ABILITIES = [
  ['Strength', 'str'],
  ['Dexterity', 'dex'],
  ['Constitution', 'con'],
  ['Intelligence', 'int'],
  ['Wisdom', 'wis'],
  ['Charisma', 'cha'],
] as const satisfies ReadonlyArray<readonly [string, AbilityKey]>;

interface AbilityScoresSectionProps {
  draft: NpcFormDraft;
  update: NpcFormUpdate;
}

export function AbilityScoresSection({
  draft,
  update,
}: AbilityScoresSectionProps) {
  return (
    <Section level={3} heading="Ability scores">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {ABILITIES.map(([name, key]) => (
          <NumberInput
            key={key}
            label={name}
            min={1}
            max={30}
            className="text-center tabular-nums"
            helperText={abilityMod(draft[key])}
            value={draft[key]}
            onChange={v =>
              update({ [key]: v ?? 0 } as Pick<NpcFormDraft, AbilityKey>)
            }
          />
        ))}
      </div>
    </Section>
  );
}
