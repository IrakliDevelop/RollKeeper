'use client';

import React from 'react';
import { MonsterStatBlock } from '@/types/encounter';

interface MonsterStatBlockPanelProps {
  statBlock: MonsterStatBlock;
  onUpdate?: (updates: Partial<MonsterStatBlock>) => void;
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
}: {
  title: string;
  entries: Array<{ name: string; text: string }>;
}) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="space-y-2">
      <h5 className="text-heading border-divider border-b pb-1 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h5>
      {entries.map((entry, i) => (
        <div key={i} className="text-sm">
          <span className="text-heading font-semibold italic">
            {entry.name}.
          </span>{' '}
          <span
            className="text-body"
            dangerouslySetInnerHTML={{ __html: entry.text }}
          />
        </div>
      ))}
    </div>
  );
}

export function MonsterStatBlockPanel({
  statBlock,
  onUpdate,
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
              <input
                type="number"
                value={statBlock[ability]}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val)) onUpdate({ [ability]: val });
                }}
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
      <TraitBlock title="Traits" entries={statBlock.traits} />

      {/* Actions */}
      <TraitBlock title="Actions" entries={statBlock.actions} />

      {/* Bonus Actions */}
      <TraitBlock title="Bonus Actions" entries={statBlock.bonusActions} />

      {/* Reactions */}
      <TraitBlock title="Reactions" entries={statBlock.reactions} />

      {/* Lair Actions */}
      <TraitBlock title="Lair Actions" entries={statBlock.lairActions} />
    </div>
  );
}
