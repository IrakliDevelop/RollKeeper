import { formatModifier } from '@/utils/calculations';

export interface SpellcastingStatsRowProps {
  spellAttackBonus: number | null;
  spellSaveDC: number | null;
  abilityLabel: string;
}

/** Attack / Save DC / Ability readouts at the top of the dock's spell list. */
export function SpellcastingStatsRow({
  spellAttackBonus,
  spellSaveDC,
  abilityLabel,
}: SpellcastingStatsRowProps) {
  return (
    <dl className="grid grid-cols-3 gap-x-3">
      <Stat
        label="Attack"
        value={
          spellAttackBonus === null ? '—' : formatModifier(spellAttackBonus)
        }
      />
      <Stat label="Save DC" value={spellSaveDC ?? '—'} />
      <Stat label="Ability" value={abilityLabel} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dd className="type-ui text-heading tabular-nums">{value}</dd>
      <dt className="type-small text-muted">{label}</dt>
    </div>
  );
}
