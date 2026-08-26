import type { EncounterEntity } from '@/types/encounter';

export function rollHitDie(
  entity: EncounterEntity
): {
  healAmount: number;
  hitDice: NonNullable<EncounterEntity['hitDice']>;
} | null {
  const hd = entity.hitDice;
  if (!hd || hd.current <= 0) {
    return null;
  }
  const dieMax = parseInt(hd.dieType.replace('d', ''), 10);
  const roll = Math.floor(Math.random() * dieMax) + 1;
  const conMod = entity.monsterStatBlock
    ? Math.floor((entity.monsterStatBlock.con - 10) / 2)
    : 0;
  const healAmount = Math.max(1, roll + conMod);
  return {
    healAmount,
    hitDice: { ...hd, current: hd.current - 1 },
  };
}
