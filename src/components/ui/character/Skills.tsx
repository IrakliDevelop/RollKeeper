'use client';

import { SKILL_NAMES, SKILL_ABILITY_MAP, ABILITY_ABBREVIATIONS } from "@/utils/constants";
import { formatModifier } from "@/utils/calculations";
import { SkillName, CharacterState } from "@/types/character";

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
  onRollSkillCheck
}: SkillsProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-800">
          Skills
        </h2>
        
        {/* Jack of All Trades Toggle */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="jackOfAllTrades"
            checked={jackOfAllTrades ?? false}
            onChange={onToggleJackOfAllTrades}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
          />
          <label htmlFor="jackOfAllTrades" className="text-sm font-medium text-gray-700">
            Jack of All Trades
          </label>
          <div className="group relative">
            <span className="text-gray-400 cursor-help">ⓘ</span>
            <div className="absolute right-0 top-6 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
              Bard feature: Add half proficiency bonus (rounded down) to ability checks using skills you&apos;re not proficient in.
            </div>
          </div>
        </div>
      </div>
      
      {/* Skills Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs text-gray-600 bg-gray-50 p-2 rounded">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-600 rounded"></div>
          <span>P = Proficient ({formatModifier(proficiencyBonus)})</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-600 rounded"></div>
          <span>E = Expertise ({formatModifier(proficiencyBonus * 2)})</span>
        </div>
        {jackOfAllTrades && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>J = Jack of All Trades ({formatModifier(Math.floor(proficiencyBonus / 2))})</span>
          </div>
        )}
      </div>
      
      <div className="space-y-1 flex-1 min-h-0 max-h-[40vh] lg:max-h-[60vh] xl:max-h-none overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gradient-to-b from-white to-gray-50">
        {(Object.keys(SKILL_NAMES) as SkillName[]).map((skillName) => {
          const skill = skills[skillName];
          const isProficient = skill.proficient;
          const hasExpertise = skill.expertise;
          
          return (
            <div key={skillName} className="flex items-center gap-2 p-1 hover:bg-green-50 rounded text-sm transition-colors">
              {/* Proficiency Checkbox */}
              <div className="flex flex-col items-center">
                <input 
                  type="checkbox" 
                  checked={isProficient}
                  onChange={(e) => {
                    onUpdateSkillProficiency(skillName, e.target.checked);
                    // Remove expertise if proficiency is removed
                    if (!e.target.checked && hasExpertise) {
                      onUpdateSkillExpertise(skillName, false);
                    }
                  }}
                  className="w-4 h-4 text-green-600 rounded" 
                  title="Proficient"
                />
                <span className="text-xs text-gray-500 mt-0.5">P</span>
              </div>
              
              {/* Expertise Checkbox */}
              <div className="flex flex-col items-center">
                <input 
                  type="checkbox" 
                  checked={hasExpertise && isProficient}
                  onChange={(e) => onUpdateSkillExpertise(skillName, e.target.checked)}
                  disabled={!isProficient}
                  className={`w-4 h-4 rounded ${
                    isProficient 
                      ? 'text-yellow-600 focus:ring-yellow-500' 
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                  title="Expertise (Double Proficiency)"
                />
                <span className={`text-xs mt-0.5 ${
                  isProficient ? 'text-yellow-600' : 'text-gray-300'
                }`}>E</span>
              </div>
              
              {/* Skill Modifier */}
              <span className={`font-mono font-semibold w-10 text-right ${
                hasExpertise && isProficient ? 'text-yellow-700' : 
                isProficient ? 'text-green-800' : 
                jackOfAllTrades && !isProficient ? 'text-blue-600' : 'text-gray-600'
              }`}>
                {formatModifier(getSkillModifier(skillName))}
              </span>
              
              {/* Skill Name */}
              <button
                onClick={() => onRollSkillCheck(skillName)}
                className="flex-1 text-left text-gray-800 hover:text-green-700 hover:bg-green-100 px-2 py-1 rounded transition-colors cursor-pointer font-medium"
                title={`Roll ${SKILL_NAMES[skillName]} check (d20 + ${formatModifier(getSkillModifier(skillName))})`}
              >
                {SKILL_NAMES[skillName]}
              </button>
              
              {/* Ability Abbreviation */}
              <span className="text-xs text-gray-500 w-8">
                {ABILITY_ABBREVIATIONS[SKILL_ABILITY_MAP[skillName]]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
