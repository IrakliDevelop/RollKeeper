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
    <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
      <h2 className="border-divider text-heading mb-4 border-b pb-2 text-lg font-bold">
        Quick Stats
      </h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-body">Passive Perception</span>
          <span className="text-heading font-semibold">
            {passivePerception}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-body">Proficiency Bonus</span>
          <span className="text-heading font-semibold">
            {formatModifier(proficiencyBonus)}
          </span>
        </div>
      </div>
    </div>
  );
}
