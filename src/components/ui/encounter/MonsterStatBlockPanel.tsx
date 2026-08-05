'use client';

import React from 'react';
import { NumberField } from '@/components/ui/forms/NumberInput';
import type {
  MonsterStatBlock,
  NpcResource,
  StatBlockEntry,
  MonsterAbility,
} from '@/types/encounter';
import { getEntryAbilityConfig } from '@/utils/statBlockAbilities';
import { StatBlockEntryRow } from '@/components/ui/encounter/combat-screen/detail/StatBlockEntryRow';

interface MonsterStatBlockPanelProps {
  statBlock: MonsterStatBlock;
  onUpdate?: (updates: Partial<MonsterStatBlock>) => void;
  /** When provided, entries with resourceCost render a cost badge + Use button. */
  resources?: NpcResource[];
  /** entryId → usedUses (from CampaignNPC.abilityUsage). */
  abilityUsage?: Record<string, number>;
  onUseEntry?: (entry: StatBlockEntry) => void;
  onUseAbilityEntry?: (entry: StatBlockEntry) => void;
  onRestoreAbilityEntry?: (entry: StatBlockEntry) => void;
  readOnly?: boolean;
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
  abilityUsage,
  onUseEntry,
  onUseAbilityEntry,
  onRestoreAbilityEntry,
  readOnly,
}: {
  title: string;
  entries: StatBlockEntry[];
  resources?: NpcResource[];
  abilityUsage?: Record<string, number>;
  onUseEntry?: (entry: StatBlockEntry) => void;
  onUseAbilityEntry?: (entry: StatBlockEntry) => void;
  onRestoreAbilityEntry?: (entry: StatBlockEntry) => void;
  readOnly?: boolean;
}) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h5 className="text-heading border-divider border-b pb-1 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h5>
      {entries.map((entry, i) => {
        const config = entry.id ? getEntryAbilityConfig(entry) : null;
        const ability: MonsterAbility | undefined =
          config && entry.id
            ? {
                id: entry.id,
                name: entry.name,
                description: entry.text,
                usageType: config.usageType,
                rechargeOn: config.rechargeOn,
                maxUses: config.maxUses,
                usedUses: Math.min(
                  Math.max(0, abilityUsage?.[entry.id] ?? 0),
                  config.maxUses
                ),
                restType: config.restType,
              }
            : undefined;
        return (
          <StatBlockEntryRow
            key={entry.id ?? i}
            entry={entry}
            ability={onUseAbilityEntry || readOnly ? ability : undefined}
            resources={resources}
            onUseAbility={onUseAbilityEntry}
            onRestoreAbility={onRestoreAbilityEntry}
            onSpendCost={onUseEntry}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

export function MonsterStatBlockPanel({
  statBlock,
  onUpdate,
  resources,
  abilityUsage,
  onUseEntry,
  onUseAbilityEntry,
  onRestoreAbilityEntry,
  readOnly,
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
        abilityUsage={abilityUsage}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
        readOnly={readOnly}
      />

      {/* Actions */}
      <TraitBlock
        title="Actions"
        entries={statBlock.actions}
        resources={resources}
        abilityUsage={abilityUsage}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
        readOnly={readOnly}
      />

      {/* Bonus Actions */}
      <TraitBlock
        title="Bonus Actions"
        entries={statBlock.bonusActions}
        resources={resources}
        abilityUsage={abilityUsage}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
        readOnly={readOnly}
      />

      {/* Reactions */}
      <TraitBlock
        title="Reactions"
        entries={statBlock.reactions}
        resources={resources}
        abilityUsage={abilityUsage}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
        readOnly={readOnly}
      />

      {/* Lair Actions */}
      <TraitBlock
        title="Lair Actions"
        entries={statBlock.lairActions}
        resources={resources}
        abilityUsage={abilityUsage}
        onUseEntry={onUseEntry}
        onUseAbilityEntry={onUseAbilityEntry}
        onRestoreAbilityEntry={onRestoreAbilityEntry}
        readOnly={readOnly}
      />
    </div>
  );
}
