'use client';

import { formatModifier } from '@/utils/calculations';

interface QuickStatsProps {
  passivePerception: number;
  proficiencyBonus: number;
}

export default function QuickStats({
  passivePerception,
  proficiencyBonus,
}: QuickStatsProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
      <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
        Quick Stats
      </h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Passive Perception</span>
          <span className="font-semibold text-gray-800">
            {passivePerception}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Proficiency Bonus</span>
          <span className="font-semibold text-gray-800">
            {formatModifier(proficiencyBonus)}
          </span>
        </div>
      </div>
    </div>
  );
}
