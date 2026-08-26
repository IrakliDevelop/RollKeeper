/**
 * Single source of AoE template detection for spells.
 * Called from: compendium→form conversion (spellConversion.ts), live
 * auto-fill in SpellFormFields, and the lazy migrations in characterStore
 * and npcStore. Pure and synchronous — safe to run per keystroke and in bulk.
 */
import type { SpellAoe } from '@/types/spellAoe';

/** Strip TipTap HTML and 5eTools {@tag value|meta} markup, collapse whitespace. */
function normalize(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\{@\w+ ([^|}]+)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function detectSpellAoe(
  description: unknown,
  range?: unknown
): SpellAoe | null {
  const desc = typeof description === 'string' ? description : '';
  const rng = typeof range === 'string' ? range : '';
  if (!desc && !rng) return null;
  const t = normalize(`${desc} ${rng}`);

  // Ordered most-specific-first: line dims → wall → cone → cube → radius forms.
  let m =
    t.match(/line (?:that is )?(\d+) feet long and (\d+) feet wide/) ||
    t.match(/(\d+) feet long and (\d+) feet wide/);
  if (m) return { shape: 'line', sizeFeet: +m[1], widthFeet: +m[2] };

  m = t.match(/(\d+)-foot[- ]long,? (\d+)-foot[- ]wide line/);
  if (m) return { shape: 'line', sizeFeet: +m[1], widthFeet: +m[2] };

  m = t.match(/(\d+)-foot[- ]wide,? (\d+)-foot[- ]long line/);
  if (m) return { shape: 'line', sizeFeet: +m[2], widthFeet: +m[1] };

  m = t.match(/(\d+)-foot line/);
  if (m) return { shape: 'line', sizeFeet: +m[1], widthFeet: 5 };

  m = t.match(/wall[^.]{0,80}?up to (\d+) feet long/);
  if (m) return { shape: 'line', sizeFeet: +m[1], widthFeet: 5 };

  m = t.match(/(\d+)[- ]foot cone/);
  if (m) return { shape: 'cone', sizeFeet: +m[1] };

  m = t.match(/(\d+)[- ]foot cube/);
  if (m) return { shape: 'square', sizeFeet: +m[1] };

  m = t.match(/(\d+)[- ]foot square/);
  if (m) return { shape: 'square', sizeFeet: +m[1] };

  m = t.match(/(\d+)[- ]foot[- ]radius/);
  if (m) return { shape: 'circle', sizeFeet: +m[1] };

  m = t.match(/(\d+)[- ]foot emanation/);
  if (m) return { shape: 'circle', sizeFeet: +m[1] };

  m = t.match(/(\d+)[- ]foot[- ]diameter/);
  if (m) return { shape: 'circle', sizeFeet: Math.round(+m[1] / 2) };

  m = t.match(/radius of (\d+) feet/);
  if (m) return { shape: 'circle', sizeFeet: +m[1] };

  m = t.match(
    /(?:each|every|all) creatures? (?:of your choice )?within (\d+) feet of you/
  );
  if (m) return { shape: 'circle', sizeFeet: +m[1] };

  m = t.match(/within (\d+) feet of (?:that|a|the) point/);
  if (m) return { shape: 'circle', sizeFeet: +m[1] };

  m = t.match(/around you to a distance of (\d+) feet/);
  if (m) return { shape: 'circle', sizeFeet: +m[1] };

  return null;
}

/**
 * Semantic equality for AoE values. null and undefined both mean "no AoE".
 * Missing widthFeet is treated as the default 5.
 */
export function aoeEquals(
  a: SpellAoe | null | undefined,
  b: SpellAoe | null | undefined
): boolean {
  if (!a || !b) return !a && !b;
  return (
    a.shape === b.shape &&
    a.sizeFeet === b.sizeFeet &&
    (a.widthFeet ?? 5) === (b.widthFeet ?? 5)
  );
}
