/** Sentence-case item rarity for display ("very rare" → "Very rare"). */
export function formatRarity(rarity: string): string {
  const lower = rarity.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
