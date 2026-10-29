'use client';

import { formatModifier } from '@/utils/calculations';
import { Section } from '@/components/ui/layout/section';

interface QuickStatsProps {
  passivePerception: number;
  passiveInsight: number;
  passiveInvestigation: number;
  proficiencyBonus: number;
  carryingCapacity: number;
  currentWeight: number;
  itemCount: number;
  spellAttackBonus?: number | null;
  spellSaveDC?: number | null;
}

export default function QuickStats({
  passivePerception,
  passiveInsight,
  passiveInvestigation,
  proficiencyBonus,
  carryingCapacity,
  currentWeight,
  itemCount,
  spellAttackBonus,
  spellSaveDC,
}: QuickStatsProps) {
  const weightPercent =
    carryingCapacity > 0
      ? Math.round((currentWeight / carryingCapacity) * 100)
      : 0;
  const weightBarPercent = Math.min(100, weightPercent);

  const showWeightNudge = itemCount > 0 && currentWeight === 0;

  const encumbered = weightPercent > 100;
  const rows = [
    ['Passive Perception', passivePerception],
    ['Passive Investigation', passiveInvestigation],
    ['Passive Insight', passiveInsight],
    ['Proficiency bonus', formatModifier(proficiencyBonus)],
    ...(spellAttackBonus != null
      ? [['Spell attack', formatModifier(spellAttackBonus)]]
      : []),
    ...(spellSaveDC != null ? [['Spell save DC', spellSaveDC]] : []),
  ];
  return (
    <Section heading="Quick stats">
      <dl className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <dt className="type-body text-body">{label}</dt>
            <dd className="type-ui text-heading tabular-nums">{value}</dd>
          </div>
        ))}
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <dt className="type-body text-body">Carrying capacity</dt>
            <dd
              className={`type-ui tabular-nums ${encumbered ? 'text-ember-text' : 'text-heading'}`}
            >
              {currentWeight.toFixed(1)} / {carryingCapacity} lb
            </dd>
          </div>
          <div className="bg-divider h-1 w-full">
            <div
              className={`h-full ${encumbered ? 'bg-ember-fill' : 'bg-heading'}`}
              style={{ width: `${weightBarPercent}%` }}
            />
          </div>
          {encumbered && (
            <p className="type-small text-ember-text mt-2">Encumbered</p>
          )}
          {showWeightNudge && (
            <p className="type-small text-muted mt-2">
              None of your items have a weight. Add weights on the Inventory
              tab.
            </p>
          )}
        </div>
      </dl>
    </Section>
  );
}
