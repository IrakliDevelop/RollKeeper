'use client';

import {
  ProficiencyDot,
  type ProficiencyLevel,
} from '@/components/ui/game/ProficiencyDot';
import { ROLL_TARGET } from '@/components/ui/game/LedgerCellView';
import { formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';
import { SKILL_NAMES } from '@/utils/constants';
import type { SkillName } from '@/types/character';

export interface SkillRowProps {
  skill: SkillName;
  level: ProficiencyLevel;
  /** The skill bonus, everything included. */
  bonus: number;
  editing: boolean;
  onRoll: (skill: SkillName) => void;
}

/** One skill: dot, name (rolls in play mode) and bonus. */
export function SkillRow({
  skill,
  level,
  bonus,
  editing,
  onRoll,
}: SkillRowProps) {
  const name = SKILL_NAMES[skill];
  return (
    <li
      data-skill={skill}
      className="flex items-center gap-2 py-1 pointer-coarse:min-h-11"
    >
      <ProficiencyDot level={level} />
      {editing ? (
        <span className="type-ui text-body min-w-0 flex-1">{name}</span>
      ) : (
        <button
          type="button"
          aria-label={`Roll ${name} check`}
          onClick={() => onRoll(skill)}
          className={cn(
            'type-ui text-body min-w-0 flex-1 text-left',
            ROLL_TARGET
          )}
        >
          {name}
        </button>
      )}
      <span className="type-ui text-heading tabular-nums">
        {formatModifier(bonus)}
      </span>
    </li>
  );
}
