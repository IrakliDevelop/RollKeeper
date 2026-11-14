'use client';

import { useMemo } from 'react';

import { Section } from '@/components/ui/layout/section';
import {
  ProficiencyDot,
  ProficiencyDotButton,
  type ProficiencyLevel,
} from '@/components/ui/game/ProficiencyDot';
import { useCharacterStore } from '@/store/characterStore';
import { formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';

import { MaybeRollElement } from '../MaybeRollElement';
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

const LEVEL_NAME: ProficiencyLevel[] = ['none', 'proficient', 'expertise'];
/** Shared by header and rows so the columns line up. */
const GRID_CLASS = 'grid grid-cols-[1.5rem_1fr_3rem_3rem_3.25rem] gap-2';

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
    <Section heading="Skills" level={4}>
      <div className={cn(GRID_CLASS, 'type-caption text-muted mb-2')}>
        <span />
        <span>Skill</span>
        <span>Ability</span>
        <span className="text-right">Mod</span>
        <span className="text-right">Passive</span>
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
    </Section>
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
  const level = LEVEL_NAME[row.level];
  const label = `${row.name} proficiency: ${level}`;
  return (
    <div className={cn(GRID_CLASS, 'items-center pointer-coarse:min-h-11')}>
      {locked ? (
        <ProficiencyDot level={level} label={label} />
      ) : (
        <ProficiencyDotButton
          level={level}
          aria-label={label}
          onClick={onCycle}
        />
      )}
      <span className="type-ui text-body">{row.name}</span>
      <span className="type-small text-muted">{row.abilityAbbr}</span>
      <MaybeRollElement
        ariaLabel={`Roll ${row.name}`}
        className="type-ui text-heading text-right tabular-nums"
        onRoll={roll ? () => roll(row.name, row.modifier) : undefined}
      >
        {formatModifier(row.modifier)}
      </MaybeRollElement>
      <span className="type-ui text-muted text-right tabular-nums">
        {row.passive}
      </span>
    </div>
  );
}
