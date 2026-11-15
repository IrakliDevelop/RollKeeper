'use client';

import { useMemo } from 'react';

import { Section } from '@/components/ui/layout/section';
import {
  ProficiencyDot,
  ProficiencyDotButton,
  saveDotLabel,
} from '@/components/ui/game/ProficiencyDot';
import { useCharacterStore } from '@/store/characterStore';
import { formatModifier } from '@/utils/calculations';

import { MaybeRollElement } from '../MaybeRollElement';
import { buildProficiencyGroups, buildSaveRows } from '../SheetTabs.utils';
import { SkillsTable } from './SkillsTable';
import type {
  ProficiencyGroupView,
  SaveRowView,
  SheetRoll,
} from '../SheetDrawer.types';

export interface AbilitiesTabProps {
  locked: boolean;
  roll?: SheetRoll;
}

export function AbilitiesTab({ locked, roll }: AbilitiesTabProps) {
  const character = useCharacterStore(s => s.character);
  const updateSavingThrowProficiency = useCharacterStore(
    s => s.updateSavingThrowProficiency
  );
  const saveRows = useMemo(() => buildSaveRows(character), [character]);
  const proficiencyGroups = useMemo(
    () => buildProficiencyGroups(character),
    [character]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Section heading="Saving throws" level={4}>
          <div className="space-y-1.5">
            {saveRows.map(row => (
              <SaveRow
                key={row.ability}
                row={row}
                locked={locked}
                roll={roll}
                onToggle={() =>
                  updateSavingThrowProficiency(row.ability, !row.proficient)
                }
              />
            ))}
          </div>
        </Section>

        <Section heading="Proficiencies & languages" level={4}>
          {proficiencyGroups.length === 0 ? (
            <div className="type-body text-muted">None recorded</div>
          ) : (
            <div className="space-y-2">
              {proficiencyGroups.map(group => (
                <ProficiencyGroup key={group.label} group={group} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <SkillsTable locked={locked} roll={roll} />
    </div>
  );
}

function SaveRow({
  row,
  locked,
  roll,
  onToggle,
}: {
  row: SaveRowView;
  locked: boolean;
  roll?: SheetRoll;
  onToggle: () => void;
}) {
  const level = row.proficient ? 'proficient' : 'none';
  return (
    <div className="flex items-center gap-2 pointer-coarse:min-h-11">
      {locked ? (
        <ProficiencyDot
          level={level}
          label={`${row.name} save proficiency: ${level}`}
        />
      ) : (
        <ProficiencyDotButton
          level={level}
          pressed={row.proficient}
          aria-label={saveDotLabel(row.name)}
          onClick={onToggle}
        />
      )}
      <span className="type-ui text-body flex-1">{row.name}</span>
      <MaybeRollElement
        ariaLabel={`Roll ${row.name} save`}
        className="type-ui text-heading tabular-nums"
        onRoll={roll ? () => roll(`${row.name} Save`, row.modifier) : undefined}
      >
        {formatModifier(row.modifier)}
      </MaybeRollElement>
    </div>
  );
}

function ProficiencyGroup({ group }: { group: ProficiencyGroupView }) {
  return (
    <div>
      <div className="type-small text-muted">{group.label}</div>
      <div className="type-body text-body">{group.items.join(', ')}</div>
    </div>
  );
}
