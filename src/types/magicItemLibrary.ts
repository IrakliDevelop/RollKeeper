import type { MagicItem } from './character';

export interface CustomMagicItem extends MagicItem {
  campaignCode: string;
  tags: string[];
  group?: string;
  sourceItemId?: string;
}
