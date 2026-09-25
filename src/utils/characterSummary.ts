import type { CharacterState } from '@/types/character';

/** Total character level, preferring the summed multiclass total. */
export function totalLevel(c: CharacterState): number {
  return c.totalLevel || c.level || 1;
}

/** "Ranger 5 (Hunter) / Fighter 2" style multiclass summary. */
export function characterClassLine(c: CharacterState): string {
  const classes = c.classes ?? [];
  if (classes.length === 0)
    return `${c.class?.name ?? 'Adventurer'} ${totalLevel(c)}`;
  return classes
    .map(
      k => `${k.className} ${k.level}${k.subclass ? ` (${k.subclass})` : ''}`
    )
    .join(' / ');
}

/** "Half-Elf · Ranger 5 (Hunter) / Fighter 2 · Outlander" style summary line. */
export function characterSubtitle(c: CharacterState): string {
  return [c.race, characterClassLine(c), c.background]
    .filter(Boolean)
    .join(' · ');
}
