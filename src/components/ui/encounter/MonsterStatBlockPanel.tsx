'use client';

import React from 'react';
import { NumberField } from '@/components/ui/forms/NumberInput';
import type {
  MonsterStatBlock,
  NpcResource,
  StatBlockEntry,
} from '@/types/encounter';
import { formatUsesLabel } from '@/utils/encounterConverter';

interface MonsterStatBlockPanelProps {
  statBlock: MonsterStatBlock;
  onUpdate?: (updates: Partial<MonsterStatBlock>) => void;
  /** When provided, entries with resourceCost render a cost badge + Use button. */
  resources?: NpcResource[];
  onUseEntry?: (entry: StatBlockEntry) => void;
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2 py-0.5 text-sm">
      <span className="text-heading shrink-0 font-semibold">{label}</span>
      <span className="text-body">{value}</span>
    </div>
  );
}

function TraitBlock({
  title,
  entries,
  resources,
  onUseEntry,
}: {
  title: string;
  entries: StatBlockEntry[];
  resources?: NpcResource[];
  onUseEntry?: (entry: StatBlockEntry) => void;
}) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h5 className="text-heading border-divider border-b pb-1 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h5>
      {entries.map((entry, i) => {
        const usesLabel = formatUsesLabel(entry.name, entry.uses);
        const cost = entry.resourceCost;
        const resource = cost && resources?.find(r => r.id === cost.resourceId);
        const remaining = resource
          ? Math.max(0, resource.maxUses - resource.usesExpended)
          : 0;
        const insufficient =
          !resource || (cost != null && remaining < cost.amount);
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
            {cost && onUseEntry && (
              <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
                <span className="bg-accent-purple-bg text-accent-purple-text rounded px-1.5 py-0.5 text-[10px] font-semibold">
                  {resource
                    ? `${cost.amount > 1 ? `${cost.amount}× ` : ''}${resource.name}`
                    : 'Unknown resource'}
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
            )}{' '}
            <span
              className="text-body statblock-rich-text"
              dangerouslySetInnerHTML={{ __html: entry.text }}
            />
          </div>
        );
      })}
    </div>
  );
}

export function MonsterStatBlockPanel({
  statBlock,
  onUpdate,
  resources,
  onUseEntry,
}: MonsterStatBlockPanelProps) {
  return (
    <div className="border-accent-red-border bg-surface space-y-3 rounded-lg border p-3">
      {/* Header: type, size, alignment */}
      <div className="text-muted text-xs italic">
        {statBlock.size} {statBlock.type}
        {statBlock.alignment ? `, ${statBlock.alignment}` : ''}
        {statBlock.cr ? ` — CR ${statBlock.cr}` : ''}
      </div>

      {/* Ability Scores */}
      <div className="grid grid-cols-6 gap-1 text-center">
        {ABILITIES.map(ability => (
          <div key={ability}>
            <span className="text-heading block text-[10px] font-bold uppercase">
              {ability}
            </span>
            {onUpdate ? (
              <NumberField
                value={statBlock[ability]}
                onChange={v => {
                  if (v !== undefined) onUpdate({ [ability]: v });
                }}
                allowEmpty
                className="bg-surface-secondary text-heading mx-auto w-full rounded px-0.5 py-0.5 text-center text-sm font-medium"
              />
            ) : (
              <span className="text-heading block text-sm font-medium">
                {statBlock[ability]}
              </span>
            )}
            <span className="text-muted block text-[10px]">
              ({abilityMod(statBlock[ability])})
            </span>
          </div>
        ))}
      </div>

      {/* Core stats */}
      <div className="border-divider space-y-0.5 border-t pt-2">
        <StatRow label="Speed" value={statBlock.speed} />
        <StatRow label="HP Formula" value={statBlock.hpFormula} />
        <StatRow label="Saves" value={statBlock.saves} />
        <StatRow label="Skills" value={statBlock.skills} />
      </div>

      {/* Defenses */}
      {(statBlock.resistances ||
        statBlock.immunities ||
        statBlock.vulnerabilities ||
        statBlock.conditionImmunities.length > 0) && (
        <div className="border-divider space-y-0.5 border-t pt-2">
          <StatRow label="Resistances" value={statBlock.resistances} />
          <StatRow label="Immunities" value={statBlock.immunities} />
          <StatRow label="Vulnerabilities" value={statBlock.vulnerabilities} />
          {statBlock.conditionImmunities.length > 0 && (
            <StatRow
              label="Condition Immunities"
              value={statBlock.conditionImmunities.join(', ')}
            />
          )}
        </div>
      )}

      {/* Senses & Languages */}
      <div className="border-divider space-y-0.5 border-t pt-2">
        <StatRow
          label="Senses"
          value={
            statBlock.senses &&
            statBlock.senses.toLowerCase().includes('passive perception')
              ? statBlock.senses
              : statBlock.senses
                ? `${statBlock.senses}, passive Perception ${statBlock.passivePerception}`
                : `passive Perception ${statBlock.passivePerception}`
          }
        />
        <StatRow label="Languages" value={statBlock.languages} />
      </div>

      {/* Traits */}
      <TraitBlock
        title="Traits"
        entries={statBlock.traits}
        resources={resources}
        onUseEntry={onUseEntry}
      />

      {/* Actions */}
      <TraitBlock
        title="Actions"
        entries={statBlock.actions}
        resources={resources}
        onUseEntry={onUseEntry}
      />

      {/* Bonus Actions */}
      <TraitBlock
        title="Bonus Actions"
        entries={statBlock.bonusActions}
        resources={resources}
        onUseEntry={onUseEntry}
      />

      {/* Reactions */}
      <TraitBlock
        title="Reactions"
        entries={statBlock.reactions}
        resources={resources}
        onUseEntry={onUseEntry}
      />

      {/* Lair Actions */}
      <TraitBlock
        title="Lair Actions"
        entries={statBlock.lairActions}
        resources={resources}
        onUseEntry={onUseEntry}
      />
    </div>
  );
}
