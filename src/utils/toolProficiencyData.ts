export type ToolCategory =
  | 'artisans'
  | 'instruments'
  | 'gaming'
  | 'other'
  | 'vehicles';

export interface ToolCategoryDef {
  id: ToolCategory;
  label: string;
  items: string[];
}

export const GAMING_SETS: string[] = [
  'Dice Set',
  'Dragonchess Set',
  'Playing Card Set',
  'Three-Dragon Ante Set',
];

export const OTHER_TOOLS: string[] = [
  'Disguise Kit',
  'Forgery Kit',
  'Herbalism Kit',
  "Navigator's Tools",
  "Poisoner's Kit",
  "Thieves' Tools",
];

export const VEHICLES: string[] = [
  'Land Vehicles',
  'Water Vehicles',
  'Air Vehicles',
  'Space Vehicles',
];

export function buildToolCategories(
  artisans: string[],
  instruments: string[]
): ToolCategoryDef[] {
  return [
    { id: 'artisans', label: "Artisan's Tools", items: artisans },
    { id: 'instruments', label: 'Musical Instruments', items: instruments },
    { id: 'gaming', label: 'Gaming Sets', items: GAMING_SETS },
    { id: 'other', label: 'Other Tools & Kits', items: OTHER_TOOLS },
    { id: 'vehicles', label: 'Vehicles', items: VEHICLES },
  ];
}

export function findToolCategory(
  toolName: string,
  categories: ToolCategoryDef[]
): ToolCategory | null {
  const lower = toolName.toLowerCase().trim();
  for (const cat of categories) {
    if (cat.items.some(item => item.toLowerCase() === lower)) {
      return cat.id;
    }
  }
  return null;
}
