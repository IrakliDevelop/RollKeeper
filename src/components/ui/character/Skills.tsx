'use client';

import {
  SKILL_NAMES,
  SKILL_ABILITY_MAP,
  ABILITY_ABBREVIATIONS,
} from '@/utils/constants';
import { formatModifier } from '@/utils/calculations';
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
    <div className="flex flex-col rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-800">Skills</h2>

        {/* Jack of All Trades Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="jackOfAllTrades"
            checked={jackOfAllTrades ?? false}
            onChange={onToggleJackOfAllTrades}
            className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500"
          />
          <label
            htmlFor="jackOfAllTrades"
            className="text-sm font-medium text-gray-700"
          >
            Jack of All Trades
          </label>
          <div className="group relative">
            <span className="cursor-help text-gray-400">ⓘ</span>
            <div className="absolute top-6 right-0 z-10 w-64 rounded bg-gray-800 p-2 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              Bard feature: Add half proficiency bonus (rounded down) to ability
              checks using skills you&apos;re not proficient in.
            </div>
          </div>
        </div>
      </div>

      {/* Skills Legend */}
      <div className="mb-3 flex items-center gap-4 rounded bg-gray-50 p-2 text-xs text-gray-600">
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

      <div className="max-h-[40vh] min-h-0 flex-1 space-y-1 overflow-y-auto rounded-lg border border-gray-100 bg-gradient-to-b from-white to-gray-50 p-2 lg:max-h-[60vh] xl:max-h-none">
        {(Object.keys(SKILL_NAMES) as SkillName[]).map(skillName => {
          const skill = skills[skillName];
          const isProficient = skill.proficient;
          const hasExpertise = skill.expertise;

          return (
            <div
              key={skillName}
              className="flex items-center gap-2 rounded p-1 text-sm transition-colors hover:bg-green-50"
            >
              {/* Proficiency Checkbox */}
              <div className="flex flex-col items-center">
                <input
                  type="checkbox"
                  checked={isProficient}
                  onChange={e => {
                    onUpdateSkillProficiency(skillName, e.target.checked);
                    // Remove expertise if proficiency is removed
                    if (!e.target.checked && hasExpertise) {
                      onUpdateSkillExpertise(skillName, false);
                    }
                  }}
                  className="h-4 w-4 rounded text-green-600"
                  title="Proficient"
                />
                <span className="mt-0.5 text-xs text-gray-500">P</span>
              </div>

              {/* Expertise Checkbox */}
              <div className="flex flex-col items-center">
                <input
                  type="checkbox"
                  checked={hasExpertise && isProficient}
                  onChange={e =>
                    onUpdateSkillExpertise(skillName, e.target.checked)
                  }
                  disabled={!isProficient}
                  className={`h-4 w-4 rounded ${
                    isProficient
                      ? 'text-yellow-600 focus:ring-yellow-500'
                      : 'cursor-not-allowed text-gray-300'
                  }`}
                  title="Expertise (Double Proficiency)"
                />
                <span
                  className={`mt-0.5 text-xs ${
                    isProficient ? 'text-yellow-600' : 'text-gray-300'
                  }`}
                >
                  E
                </span>
              </div>

              {/* Skill Modifier */}
              <span
                className={`w-10 text-right font-mono font-semibold ${
                  hasExpertise && isProficient
                    ? 'text-yellow-700'
                    : isProficient
                      ? 'text-green-800'
                      : jackOfAllTrades && !isProficient
                        ? 'text-blue-600'
                        : 'text-gray-600'
                }`}
              >
                {formatModifier(getSkillModifier(skillName))}
              </span>

              {/* Skill Name */}
              <button
                onClick={() => onRollSkillCheck(skillName)}
                className="flex-1 cursor-pointer rounded px-2 py-1 text-left font-medium text-gray-800 transition-colors hover:bg-green-100 hover:text-green-700"
                title={`Roll ${SKILL_NAMES[skillName]} check (d20 + ${formatModifier(getSkillModifier(skillName))})`}
              >
                {SKILL_NAMES[skillName]}
              </button>

              {/* Ability Abbreviation */}
              <span className="w-8 text-xs text-gray-500">
                {ABILITY_ABBREVIATIONS[SKILL_ABILITY_MAP[skillName]]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
