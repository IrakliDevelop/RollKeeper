import { formatModifier } from '@/utils/calculations';

export interface SpellcastingStatsRowProps {
  spellAttackBonus: number | null;
  spellSaveDC: number | null;
  abilityLabel: string;
}

/** Three stat chips (Attack / Save DC / Ability) at the top of the dock's spell list. */
export function SpellcastingStatsRow({
  spellAttackBonus,
  spellSaveDC,
  abilityLabel,
}: SpellcastingStatsRowProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <StatChip
        label="Attack"
        value={
          spellAttackBonus === null ? '—' : formatModifier(spellAttackBonus)
        }
      />
      <StatChip label="Save DC" value={spellSaveDC ?? '—'} />
      <StatChip label="Ability" value={abilityLabel} />
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-divider rounded-lg border p-2 text-center">
      <div className="text-heading text-sm font-bold">{value}</div>
      <div className="text-faint text-[10px] uppercase">{label}</div>
    </div>
  );
}
