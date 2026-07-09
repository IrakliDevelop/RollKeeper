import type { AoeShape } from '@/types/spellAoe';
import type { Spell } from '@/types/character';

/** Glyph shown next to a row's name when the spell has an AoE template. */
export const AOE_GLYPHS: Record<AoeShape, string> = {
  circle: '●',
  cone: '◮',
  line: '▬',
  square: '■',
};

/**
 * Groups spells by level (cantrips = 0) ascending, each level's spells
 * sorted by name. Search filtering happens before this is called.
 */
export function groupSpellsByLevel(spells: Spell[]): Array<[number, Spell[]]> {
  const map = new Map<number, Spell[]>();
  for (const spell of spells) {
    const bucket = map.get(spell.level);
    if (bucket) {
      bucket.push(spell);
    } else {
      map.set(spell.level, [spell]);
    }
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => a.name.localeCompare(b.name));
  }
  return Array.from(map.entries()).sort(([a], [b]) => a - b);
}

/** Human-readable summary of how a cast was paid for, used in the success toast. */
export function describeCastPayment(
  level: number,
  useFreecast?: boolean,
  isRitual?: boolean,
  usePact?: boolean
): string {
  if (isRitual) return 'Cast as ritual — no slot used';
  if (usePact) return `Pact slot used (level ${level})`;
  if (useFreecast) return 'Free cast — no slot used';
  if (level === 0) return 'Cantrip — no slot used';
  return `Level ${level} slot used`;
}
