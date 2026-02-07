'use client';

import {
  SKILL_NAMES,
  SKILL_ABILITY_MAP,
  ABILITY_ABBREVIATIONS,
} from '@/utils/constants';
import { formatModifier } from '@/utils/calculations';
import { Checkbox } from '@/components/ui/forms';
import { SkillName, CharacterState } from '@/types/character';

interface SkillsProps {
  skills: CharacterState['skills'];
  jackOfAllTrades: boolean;
  proficiencyBonus: number;
  getSkillModifier: (skillName: SkillName) => number;
  onUpdateSkillProficiency: (skillName: SkillName, proficient: boolean) => void;
  onUpdateSkillExpertise: (skillName: SkillName, expertise: boolean) => void;
  onToggleJackOfAllTrades: () => void;
  onRollSkillCheck: (skillName: SkillName) => void;
}

export default function Skills({
  skills,
  jackOfAllTrades,
  proficiencyBonus,
  getSkillModifier,
  onUpdateSkillProficiency,
  onUpdateSkillExpertise,
  onToggleJackOfAllTrades,
  onRollSkillCheck,
}: SkillsProps) {
  return (
    <div className="border-accent-amber-border bg-surface-raised flex flex-col rounded-lg border p-6 shadow-lg">
      <div className="border-divider mb-4 flex items-center justify-between border-b pb-2">
        <h2 className="text-heading text-lg font-bold">Skills</h2>

        {/* Jack of All Trades Toggle */}
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={jackOfAllTrades ?? false}
            onCheckedChange={onToggleJackOfAllTrades}
            label="Jack of All Trades"
            size="sm"
            variant="primary"
          />
          <div className="group relative">
            <span className="text-faint cursor-help">ⓘ</span>
            <div className="bg-surface-inset text-heading absolute top-6 right-0 z-10 w-64 rounded p-2 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Bard feature: Add half proficiency bonus (rounded down) to ability
              checks using skills you&apos;re not proficient in.
            </div>
          </div>
        </div>
      </div>

      {/* Skills Legend */}
      <div className="bg-surface-secondary text-body mb-3 flex items-center gap-4 rounded p-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-green-600"></div>
          <span>P = Proficient ({formatModifier(proficiencyBonus)})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-yellow-600"></div>
          <span>E = Expertise ({formatModifier(proficiencyBonus * 2)})</span>
        </div>
        {jackOfAllTrades && (
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-blue-500"></div>
            <span>
              J = Jack of All Trades (
              {formatModifier(Math.floor(proficiencyBonus / 2))})
            </span>
          </div>
        )}
      </div>

      <div className="border-divider from-surface-raised to-surface-secondary max-h-[40vh] min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border bg-gradient-to-b p-2 lg:max-h-[60vh] xl:max-h-none">
        {(Object.keys(SKILL_NAMES) as SkillName[]).map(skillName => {
          const skill = skills[skillName];
          const isProficient = skill.proficient;
          const hasExpertise = skill.expertise;

          return (
            <div
              key={skillName}
              className="hover:bg-accent-green-bg flex items-center gap-2 rounded p-1 text-sm transition-colors"
            >
              {/* Proficiency Checkbox */}
              <div className="flex flex-col items-center">
                <Checkbox
                  checked={isProficient}
                  onCheckedChange={checked => {
                    onUpdateSkillProficiency(skillName, checked);
                    // Remove expertise if proficiency is removed
                    if (!checked && hasExpertise) {
                      onUpdateSkillExpertise(skillName, false);
                    }
                  }}
                  size="sm"
                  variant="success"
                  title="Proficient"
                />
                <span className="text-muted mt-0.5 text-xs">P</span>
              </div>

              {/* Expertise Checkbox */}
              <div className="flex flex-col items-center">
                <Checkbox
                  checked={hasExpertise && isProficient}
                  onCheckedChange={checked =>
                    onUpdateSkillExpertise(skillName, checked)
                  }
                  disabled={!isProficient}
                  size="sm"
                  variant="warning"
                  title="Expertise (Double Proficiency)"
                />
                <span
                  className={`mt-0.5 text-xs ${
                    isProficient ? 'text-yellow-600' : 'text-faint'
                  }`}
                >
                  E
                </span>
              </div>

              {/* Skill Modifier */}
              <span
                className={`w-10 text-right font-mono font-semibold ${
                  hasExpertise && isProficient
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : isProficient
                      ? 'text-accent-green-text'
                      : jackOfAllTrades && !isProficient
                        ? 'text-accent-blue-text-muted'
                        : 'text-body'
                }`}
              >
                {formatModifier(getSkillModifier(skillName))}
              </span>

              {/* Skill Name */}
              <button
                onClick={() => onRollSkillCheck(skillName)}
                className="text-heading hover:bg-accent-green-bg-strong hover:text-accent-green-text flex-1 cursor-pointer rounded px-2 py-1 text-left font-medium transition-colors"
                title={`Roll ${SKILL_NAMES[skillName]} check (d20 + ${formatModifier(getSkillModifier(skillName))})`}
              >
                {SKILL_NAMES[skillName]}
              </button>

              {/* Ability Abbreviation */}
              <span className="text-muted w-8 text-xs">
                {ABILITY_ABBREVIATIONS[SKILL_ABILITY_MAP[skillName]]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
