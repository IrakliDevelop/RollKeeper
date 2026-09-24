'use client';

import { useMemo } from 'react';

import { useCharacterStore } from '@/store/characterStore';
import { formatModifier } from '@/utils/calculations';

import { MaybeRollElement } from '../MaybeRollElement';
import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';
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
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={SECTION_CLASS}>
          <h3 className={HEADING_CLASS}>Saving Throws</h3>
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
        </div>

        <div className={SECTION_CLASS}>
          <h3 className={HEADING_CLASS}>Proficiencies & Languages</h3>
          {proficiencyGroups.length === 0 ? (
            <div className="text-muted text-sm">None recorded</div>
          ) : (
            <div className="space-y-2">
              {proficiencyGroups.map(group => (
                <ProficiencyGroup key={group.label} group={group} />
              ))}
            </div>
          )}
        </div>
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
  const dotClass = `h-2.5 w-2.5 rounded-full ${
    row.proficient ? 'bg-accent-emerald-text-muted' : 'border border-divider'
  }`;
  return (
    <div className="flex items-center gap-2 text-sm">
      {locked ? (
        <span
          role="img"
          className={dotClass}
          aria-label={`${row.name} save proficiency: ${row.proficient ? 'proficient' : 'none'}`}
          title={`${row.proficient ? 'Proficient' : 'Not proficient'} · unlock to change`}
        />
      ) : (
        <button
          type="button"
          aria-label={`${row.name} save proficiency`}
          aria-pressed={row.proficient}
          onClick={onToggle}
          className="flex h-5 w-5 items-center justify-center"
        >
          <span className={dotClass} />
        </button>
      )}
      <span className="text-body flex-1">{row.name}</span>
      <MaybeRollElement
        ariaLabel={`Roll ${row.name} save`}
        className="text-heading font-semibold"
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
      <div className="text-muted text-xs font-semibold">{group.label}</div>
      <div className="text-body text-sm">{group.items.join(', ')}</div>
    </div>
  );
}
