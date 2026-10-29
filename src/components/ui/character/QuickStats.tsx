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
      <div className="grid grid-cols-3 gap-x-4 gap-y-5">
        {rows.map(([label, value]) => (
          <dl key={label} className="flex min-w-0 flex-col-reverse">
            <dt className="type-caption text-muted">{label}</dt>
            <dd className="type-num-lg text-heading tabular-nums">{value}</dd>
          </dl>
        ))}
      </div>
      <div className="mt-5 space-y-2">
        <dl className="flex flex-wrap items-baseline gap-x-3">
          <dt className="type-body text-body">Carrying capacity</dt>
          <dd
            className={`type-ui tabular-nums ${encumbered ? 'text-ember-text' : 'text-heading'}`}
          >
            {currentWeight.toFixed(1)} / {carryingCapacity} lb
          </dd>
        </dl>
        <div className="bg-divider h-1 w-full">
          <div
            className={`h-full ${encumbered ? 'bg-ember-fill' : 'bg-heading'}`}
            style={{ width: `${weightBarPercent}%` }}
          />
        </div>
        {encumbered && <p className="type-small text-ember-text">Encumbered</p>}
        {showWeightNudge && (
          <p className="type-small text-muted">
            None of your items have a weight. Add weights on the Inventory tab.
          </p>
        )}
      </div>
    </Section>
  );
}
