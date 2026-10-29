'use client';

import { Badge } from '@/components/ui/layout/badge';
import {
  ProficiencyDot,
  ProficiencyDotButton,
  skillDotLabel,
  type ProficiencyLevel,
} from '@/components/ui/game/ProficiencyDot';
import { ROLL_TARGET } from '@/components/ui/game/LedgerCellView';
import { formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';
import { ABILITY_ABBREVIATIONS, SKILL_NAMES } from '@/utils/constants';
import type { AbilityName, SkillName } from '@/types/character';
import { BonusAbilityPicker } from './BonusAbilityPicker';

export interface SkillRowProps {
  skill: SkillName;
  /** The skill's own ability, left out of the bonus ability choices. */
  ability: AbilityName;
  level: ProficiencyLevel;
  /** The skill bonus, everything included. */
  bonus: number;
  bonusAbilities: AbilityName[];
  editing: boolean;
  onRoll: (skill: SkillName) => void;
  onDotTap: (skill: SkillName, level: ProficiencyLevel) => void;
  onToggleBonusAbility?: (skill: SkillName, ability: AbilityName) => void;
}

/**
 * One skill: dot, name and bonus. Play mode: the name rolls. Edit mode: the
 * dot cycles the proficiency, and "+WIS" badges show the bonus abilities
 * with a control to choose them.
 */
export function SkillRow({
  skill,
  ability,
  level,
  bonus,
  bonusAbilities,
  editing,
  onRoll,
  onDotTap,
  onToggleBonusAbility,
}: SkillRowProps) {
  const name = SKILL_NAMES[skill];
  return (
    <li
      data-skill={skill}
      className="flex items-center gap-2 py-1 pointer-coarse:min-h-11"
    >
      {editing ? (
        <ProficiencyDotButton
          level={level}
          aria-label={skillDotLabel(name, level)}
          onClick={() => onDotTap(skill, level)}
        />
      ) : (
        <ProficiencyDot level={level} />
      )}
      {editing ? (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="type-ui text-body">{name}</span>
          {bonusAbilities.map(bonusAbility => (
            <Badge key={bonusAbility} variant="neutral" size="sm">
              +{ABILITY_ABBREVIATIONS[bonusAbility]}
            </Badge>
          ))}
        </span>
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
      {editing && onToggleBonusAbility && (
        <BonusAbilityPicker
          skill={skill}
          ability={ability}
          bonusAbilities={bonusAbilities}
          onToggle={onToggleBonusAbility}
        />
      )}
      <span className="type-ui text-heading w-8 shrink-0 text-right tabular-nums">
        {formatModifier(bonus)}
      </span>
    </li>
  );
}
