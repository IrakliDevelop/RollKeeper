import { formatRarity } from '@/utils/formatRarity';
import { sentenceCase } from '../PlayerDetailDialog/shared';
import type { NPCInventoryItem } from '@/types/encounter';

/** "Rare · Wondrous": the rarity and type parts that are set, in reading order. */
export function itemKindParts(item: NPCInventoryItem): string[] {
  const parts: string[] = [];
  if (item.rarity && item.rarity !== 'none') {
    parts.push(formatRarity(item.rarity));
  }
  if (item.type) parts.push(sentenceCase(item.type));
  return parts;
}
