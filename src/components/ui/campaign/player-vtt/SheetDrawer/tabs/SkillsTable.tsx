'use client';

import { useMemo } from 'react';

import { useCharacterStore } from '@/store/characterStore';
import { formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';

import { MaybeRollElement } from '../MaybeRollElement';
import { HEADING_CLASS, SECTION_CLASS } from '../sheetSectionStyles';
import { buildSkillRows, nextSkillLevel } from '../SheetTabs.utils';
import type {
  SheetRoll,
  SkillProfLevel,
  SkillRowView,
} from '../SheetDrawer.types';
import type { SkillName } from '@/types/character';

export interface SkillsTableProps {
  locked: boolean;
  roll?: SheetRoll;
}

const DOT_LABEL = ['Not proficient', 'Proficient', 'Expertise'];
const LEVEL_NAME = ['none', 'proficient', 'expertise'];
/** Shared by header and rows so the columns line up. */
const GRID_CLASS = 'grid grid-cols-[1.25rem_1fr_2.5rem_3rem_2.5rem] gap-2';

function dotClassName(level: SkillProfLevel): string {
  if (level === 2) {
    return 'bg-accent-emerald-text-muted ring-2 ring-accent-emerald-border';
  }
  if (level === 1) {
    return 'bg-accent-emerald-text-muted';
  }
  return 'border border-divider';
}

export function SkillsTable({ locked, roll }: SkillsTableProps) {
  const character = useCharacterStore(s => s.character);
  const updateSkillProficiency = useCharacterStore(
    s => s.updateSkillProficiency
  );
  const updateSkillExpertise = useCharacterStore(s => s.updateSkillExpertise);
  const rows = useMemo(() => buildSkillRows(character), [character]);

  const setLevel = (skill: SkillName, next: SkillProfLevel) => {
    if (next === 0) {
      updateSkillExpertise(skill, false);
      updateSkillProficiency(skill, false);
    } else if (next === 1) {
      updateSkillProficiency(skill, true);
      updateSkillExpertise(skill, false);
    } else {
      updateSkillProficiency(skill, true);
      updateSkillExpertise(skill, true);
    }
  };

  return (
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Skills</h3>
      <div
        className={cn(
          GRID_CLASS,
          'text-faint mb-2 text-xs font-bold uppercase'
        )}
      >
        <span />
        <span>Skill</span>
        <span>Abl</span>
        <span className="text-right">Mod</span>
        <span className="text-right">Pass</span>
      </div>
      <div className="space-y-1">
        {rows.map(row => (
          <SkillRow
            key={row.skill}
            row={row}
            locked={locked}
            roll={roll}
            onCycle={() => setLevel(row.skill, nextSkillLevel(row.level))}
          />
        ))}
      </div>
    </div>
  );
}

function SkillRow({
  row,
  locked,
  roll,
  onCycle,
}: {
  row: SkillRowView;
  locked: boolean;
  roll?: SheetRoll;
  onCycle: () => void;
}) {
  const dotClass = cn('h-2.5 w-2.5 rounded-full', dotClassName(row.level));
  return (
    <div className={cn(GRID_CLASS, 'items-center text-sm')}>
      {locked ? (
        <span
          role="img"
          className="flex h-5 w-5 items-center justify-center"
          aria-label={`${row.name} proficiency: ${LEVEL_NAME[row.level]}`}
          title={`${DOT_LABEL[row.level]} · unlock to change`}
        >
          <span className={dotClass} />
        </span>
      ) : (
        <button
          type="button"
          aria-label={`${row.name} proficiency: ${LEVEL_NAME[row.level]}`}
          title="Tap to cycle proficiency"
          onClick={onCycle}
          className="flex h-5 w-5 items-center justify-center"
        >
          <span className={dotClass} />
        </button>
      )}
      <span className="text-body">{row.name}</span>
      <span className="text-faint text-xs uppercase">{row.abilityAbbr}</span>
      <MaybeRollElement
        ariaLabel={`Roll ${row.name}`}
        className="text-heading text-right font-semibold"
        onRoll={roll ? () => roll(row.name, row.modifier) : undefined}
      >
        {formatModifier(row.modifier)}
      </MaybeRollElement>
      <span className="text-muted text-right">{row.passive}</span>
    </div>
  );
}
