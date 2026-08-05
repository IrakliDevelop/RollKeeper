'use client';

import React from 'react';
import { renderStatBlockEntryText } from '@/utils/statBlockText';
import { StatBlockEntryRow } from './StatBlockEntryRow';
import type {
  MonsterAbility,
  MonsterStatBlock,
  MonsterSpellcasting,
  NpcResource,
  StatBlockEntry,
} from '@/types/encounter';

interface TraitBlockProps {
  title: string;
  entries: StatBlockEntry[];
  resources?: NpcResource[];
  abilities?: MonsterAbility[];
  onUseEntry?: (entry: StatBlockEntry) => void;
  onUseAbilityEntry?: (entry: StatBlockEntry) => void;
  onRestoreAbilityEntry?: (entry: StatBlockEntry) => void;
}

function TraitBlock({
  title,
  entries,
  resources,
  abilities,
  onUseEntry,
  onUseAbilityEntry,
  onRestoreAbilityEntry,
}: TraitBlockProps) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h5 className="text-heading border-divider border-b pb-0.5 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h5>
      {entries.map((entry, i) => (
        <StatBlockEntryRow
          key={entry.id ?? i}
          entry={entry}
          ability={
            entry.id ? abilities?.find(a => a.id === entry.id) : undefined
          }
          resources={resources}
          onUseAbility={onUseAbilityEntry}
          onRestoreAbility={onRestoreAbilityEntry}
          onSpendCost={onUseEntry}
          renderText={renderStatBlockEntryText}
        />
      ))}
    </div>
  );
}

interface SpellcastingBlockProps {
  spellcasting: MonsterSpellcasting;
}

function SpellcastingBlock({ spellcasting: sc }: SpellcastingBlockProps) {
  const perDayEntries = Object.entries(sc.perDay);
  return (
    <div className="space-y-1.5">
      <h5 className="text-heading border-divider border-b pb-0.5 text-xs font-semibold tracking-wider uppercase">
        Spellcasting
      </h5>
      <div className="text-body space-y-0.5 text-xs">
        <p>
          <span className="text-heading font-semibold">Ability:</span>{' '}
          {sc.ability}
        </p>
        <p>
          <span className="text-heading font-semibold">Save DC:</span> {sc.dc}
          {' · '}
          <span className="text-heading font-semibold">Attack:</span> +
          {sc.toHit}
        </p>
        {sc.atWill.length > 0 && (
          <p>
            <span className="text-heading font-semibold">At Will:</span>{' '}
            {sc.atWill.join(', ')}
          </p>
        )}
        {perDayEntries.map(([times, spells]) => (
          <p key={times}>
            <span className="text-heading font-semibold">{times}/Day:</span>{' '}
            {spells.join(', ')}
          </p>
        ))}
        {sc.slots &&
          Object.entries(sc.slots).map(([level, slot]) => (
            <p key={level}>
              <span className="text-heading font-semibold">Level {level}:</span>{' '}
              {slot.max - slot.used}/{slot.max} slots
            </p>
          ))}
      </div>
    </div>
  );
}

interface StatBlockTraitsProps {
  statBlock: MonsterStatBlock;
  spellcasting?: MonsterSpellcasting;
  resources?: NpcResource[];
  abilities?: MonsterAbility[];
  onUseEntry?: (entry: StatBlockEntry) => void;
  onUseAbilityEntry?: (entry: StatBlockEntry) => void;
  onRestoreAbilityEntry?: (entry: StatBlockEntry) => void;
}

export function StatBlockTraits({
  statBlock,
  spellcasting,
  resources,
  abilities,
  onUseEntry,
  onUseAbilityEntry,
  onRestoreAbilityEntry,
}: StatBlockTraitsProps) {
  const hasSections =
    statBlock.traits.length > 0 ||
    statBlock.actions.length > 0 ||
    statBlock.bonusActions.length > 0 ||
    statBlock.reactions.length > 0 ||
    statBlock.lairActions.length > 0 ||
    spellcasting != null;

  if (!hasSections) return null;

  return (
    <div className="space-y-3">
      <TraitBlock
        title="Traits"
        entries={statBlock.traits}
        resources={resources}
        abilities={abilities}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
      />
      <TraitBlock
        title="Actions"
        entries={statBlock.actions}
        resources={resources}
        abilities={abilities}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
      />
      <TraitBlock
        title="Bonus Actions"
        entries={statBlock.bonusActions}
        resources={resources}
        abilities={abilities}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
      />
      <TraitBlock
        title="Reactions"
        entries={statBlock.reactions}
        resources={resources}
        abilities={abilities}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
      />
      <TraitBlock
        title="Lair Actions"
        entries={statBlock.lairActions}
        resources={resources}
        abilities={abilities}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
      />
      {spellcasting && <SpellcastingBlock spellcasting={spellcasting} />}
    </div>
  );
}
