'use client';

import React from 'react';
import { renderStatBlockEntryText } from '@/utils/statBlockText';
import { formatUsesLabel } from '@/utils/encounterConverter';
import type {
  MonsterStatBlock,
  MonsterSpellcasting,
  NpcResource,
  StatBlockEntry,
} from '@/types/encounter';

interface EntryCostControlProps {
  entry: StatBlockEntry;
  resources: NpcResource[] | undefined;
  onUseEntry: ((entry: StatBlockEntry) => void) | undefined;
}

/** Cost badge + explicit Use button for entries linked to an NpcResource. */
function EntryCostControl({
  entry,
  resources,
  onUseEntry,
}: EntryCostControlProps) {
  const cost = entry.resourceCost;
  if (!cost || !onUseEntry) return null;

  const resource = resources?.find(r => r.id === cost.resourceId);
  const remaining = resource
    ? Math.max(0, resource.maxUses - resource.usesExpended)
    : 0;
  const insufficient = !resource || remaining < cost.amount;
  const label = resource
    ? `${cost.amount > 1 ? `${cost.amount}× ` : ''}${resource.name}`
    : 'Unknown resource';

  return (
    <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
      <span className="bg-accent-purple-bg text-accent-purple-text rounded px-1.5 py-0.5 text-[10px] font-semibold">
        {label}
      </span>
      <button
        onClick={() => onUseEntry(entry)}
        disabled={insufficient}
        title={
          !resource
            ? 'Resource removed'
            : insufficient
              ? `Not enough ${resource.name} uses`
              : `Spend ${cost.amount} ${resource.name}`
        }
        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
          insufficient
            ? 'bg-surface-raised text-faint cursor-not-allowed'
            : 'bg-accent-amber-bg text-accent-amber-text hover:opacity-80'
        }`}
      >
        Use
      </button>
    </span>
  );
}

interface TraitBlockProps {
  title: string;
  entries: StatBlockEntry[];
  resources?: NpcResource[];
  onUseEntry?: (entry: StatBlockEntry) => void;
}

function TraitBlock({
  title,
  entries,
  resources,
  onUseEntry,
}: TraitBlockProps) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <h5 className="text-heading border-divider border-b pb-0.5 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h5>
      {entries.map((entry, i) => {
        const usesLabel = formatUsesLabel(entry.name, entry.uses);
        return (
          <div key={i} className="text-sm">
            <span className="text-heading font-semibold italic">
              {entry.name}.
            </span>
            {usesLabel && (
              <span className="text-heading font-semibold italic">
                {' '}
                ({usesLabel})
              </span>
            )}
            <EntryCostControl
              entry={entry}
              resources={resources}
              onUseEntry={onUseEntry}
            />{' '}
            <span
              className="text-body"
              dangerouslySetInnerHTML={{
                __html: renderStatBlockEntryText(entry.text),
              }}
            />
          </div>
        );
      })}
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
  onUseEntry?: (entry: StatBlockEntry) => void;
}

export function StatBlockTraits({
  statBlock,
  spellcasting,
  resources,
  onUseEntry,
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
        onUseEntry={onUseEntry}
      />
      <TraitBlock
        title="Actions"
        entries={statBlock.actions}
        resources={resources}
        onUseEntry={onUseEntry}
      />
      <TraitBlock
        title="Bonus Actions"
        entries={statBlock.bonusActions}
        resources={resources}
        onUseEntry={onUseEntry}
      />
      <TraitBlock
        title="Reactions"
        entries={statBlock.reactions}
        resources={resources}
        onUseEntry={onUseEntry}
      />
      <TraitBlock
        title="Lair Actions"
        entries={statBlock.lairActions}
        resources={resources}
        onUseEntry={onUseEntry}
      />
      {spellcasting && <SpellcastingBlock spellcasting={spellcasting} />}
    </div>
  );
}
