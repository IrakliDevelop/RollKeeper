export interface RawBaseItem {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  basicRules?: boolean;
  srd52?: boolean;
  basicRules2024?: boolean;
  edition?: string;
  reprintedAs?: string[];
  type?: string;
  rarity?: string;
  weight?: number;
  value?: number;
  entries?: (string | RawItemEntry)[];
  additionalEntries?: (string | RawItemEntry)[];

  // Weapon fields
  weapon?: boolean;
  weaponCategory?: string;
  property?: string[];
  range?: string;
  dmg1?: string;
  dmg2?: string;
  dmgType?: string;
  mastery?: string[];

  // Armor fields
  armor?: boolean;
  ac?: number;
  strength?: string;
  stealth?: boolean;
}

export interface RawItemEntry {
  type: string;
  name?: string;
  entries?: (string | RawItemEntry)[];
  items?: (string | RawItemEntry)[];
  caption?: string;
  colLabels?: string[];
  rows?: string[][];
}

export interface ProcessedItem {
  id: string;
  name: string;
  source: string;
  category: string;
  rarity: string;
  weight?: number;
  value?: number;
  description: string;
  tags: string[];
  weaponCategory?: string;
  damage?: string;
  damageType?: string;
  ac?: number;
  properties?: string[];
  range?: string;
  rawType: string;
}
