import type { BuffEffect, BuffTargetStat } from '@/types/character';

const STAT_LABELS: Record<BuffTargetStat, string> = {
  ac: 'AC',
  maxHp: 'max HP',
  tempHp: 'temp HP',
  speed: 'speed',
  savingThrow: 'save',
  attackBonus: 'attack',
  damageResistance: 'resistance',
  damageImmunity: 'immunity',
  conditionImmunity: 'immune',
};

function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** One-line human summary of a buff's effects, e.g. "+3 AC · resistance: fire". */
export function summarizeBuffEffects(effects: BuffEffect[]): string {
  return effects
    .map(effect => {
      switch (effect.targetStat) {
        case 'damageResistance':
          return `resistance: ${effect.targetDamageType ?? 'damage'}`;
        case 'damageImmunity':
          return `immunity: ${effect.targetDamageType ?? 'damage'}`;
        case 'conditionImmunity':
          return `immune: ${effect.targetCondition ?? 'condition'}`;
        default:
          break;
      }
      const label =
        effect.targetStat === 'savingThrow' && effect.targetAbility
          ? `${effect.targetAbility.slice(0, 3).toUpperCase()} save`
          : STAT_LABELS[effect.targetStat];
      switch (effect.mode) {
        case 'set':
          return `${label} = ${effect.value}`;
        case 'floor':
          return `${label} ≥ ${effect.value}`;
        case 'add':
        case 'grant':
          return `${signed(effect.value)} ${label}`;
      }
    })
    .join(' · ');
}
