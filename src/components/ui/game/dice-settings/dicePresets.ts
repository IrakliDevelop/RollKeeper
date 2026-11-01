import {
  classic,
  obsidian,
  brass,
  oak,
  sapphire,
  ruby,
  emerald,
  amethyst,
  topaz,
  aquamarine,
  smoke,
} from 'pollyroll/render';
import type { Skin } from 'pollyroll';

export const DICE_PRESETS: readonly {
  id: string;
  name: string;
  description: string;
  skin: Skin;
}[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'White plastic',
    skin: classic,
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Dark stone',
    skin: obsidian,
  },
  { id: 'brass', name: 'Brass', description: 'Warm metal', skin: brass },
  { id: 'oak', name: 'Oak', description: 'Wood grain', skin: oak },
  {
    id: 'sapphire',
    name: 'Sapphire',
    description: 'Blue glass',
    skin: sapphire,
  },
  { id: 'ruby', name: 'Ruby', description: 'Red gem', skin: ruby },
  { id: 'emerald', name: 'Emerald', description: 'Green glass', skin: emerald },
  {
    id: 'amethyst',
    name: 'Amethyst',
    description: 'Purple gem',
    skin: amethyst,
  },
  { id: 'topaz', name: 'Topaz', description: 'Golden gem', skin: topaz },
  {
    id: 'aquamarine',
    name: 'Aquamarine',
    description: 'Clear blue glass',
    skin: aquamarine,
  },
  { id: 'smoke', name: 'Smoke', description: 'Smoky glass', skin: smoke },
];

export const DICE_MATERIALS = [
  'plastic',
  'metal',
  'wood',
  'glass',
  'stone',
  'gem',
] as const;
export const DICE_PATTERNS = [
  'none',
  'gradient',
  'speckle',
  'marble',
  'wood',
  'swirl',
] as const;
export const DICE_LABEL_STYLES = ['engraved', 'printed', 'embossed'] as const;
export const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const diceSkinSignature = (skin: Skin) =>
  JSON.stringify([
    skin.material,
    skin.color,
    skin.labelColor,
    skin.labelStyle,
    skin.pattern,
    skin.font,
  ]);
