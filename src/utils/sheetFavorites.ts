import type {
  CharacterState,
  SheetFavorite,
  SheetFavoriteKind,
} from '@/types/character';

type SheetFavoriteSource = Pick<
  CharacterState,
  'sheetFavorites' | 'favoriteFeatureIds' | 'spellbook'
>;

const favoriteKey = (kind: SheetFavoriteKind, id: string) => `${kind}:${id}`;

/**
 * The ordered pin list for the sheet drawer. Legacy flags
 * (`favoriteFeatureIds`, `spellbook.favoriteSpells`) are authoritative for
 * feature/spell membership so unpinning on the full sheet is honoured;
 * `sheetFavorites` contributes items and the pin order.
 */
export function resolveSheetFavorites(c: SheetFavoriteSource): SheetFavorite[] {
  const legacySpells = new Set(c.spellbook?.favoriteSpells ?? []);
  const legacyFeatures = new Set(c.favoriteFeatureIds ?? []);
  const seen = new Set<string>();
  const result: SheetFavorite[] = [];
  const push = (kind: SheetFavoriteKind, id: string) => {
    const key = favoriteKey(kind, id);
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ kind, id });
  };

  const pinned = Array.isArray(c.sheetFavorites) ? c.sheetFavorites : [];
  for (const favorite of pinned) {
    if (favorite.kind === 'spell' && !legacySpells.has(favorite.id)) continue;
    if (favorite.kind === 'feature' && !legacyFeatures.has(favorite.id))
      continue;
    push(favorite.kind, favorite.id);
  }
  for (const id of legacyFeatures) push('feature', id);
  for (const id of legacySpells) push('spell', id);
  return result;
}

export function isSheetFavorite(
  c: SheetFavoriteSource,
  kind: SheetFavoriteKind,
  id: string
): boolean {
  return resolveSheetFavorites(c).some(f => f.kind === kind && f.id === id);
}
