import type {
  LabelStyle,
  MaterialParams,
  MaterialPreset,
  PatternName,
  Skin,
} from 'pollyroll';
import { classic } from 'pollyroll/render';
import type { CharacterDiceSet } from '@/types/dice';

export const MIN_DIE_SCALE = 0.75;
export const MAX_DIE_SCALE = 2.5;

const MATERIALS: readonly MaterialPreset[] = [
  'plastic',
  'metal',
  'wood',
  'glass',
  'stone',
  'gem',
];
const LABEL_STYLES: readonly LabelStyle[] = ['engraved', 'printed', 'embossed'];
const PATTERNS: readonly PatternName[] = [
  'none',
  'gradient',
  'speckle',
  'marble',
  'wood',
  'swirl',
];
const HEX = /^#[0-9a-f]{6}$/i;
const PARAMS = [
  'metalness',
  'roughness',
  'clearcoat',
  'transmission',
  'tint',
  'sparkle',
] as const;

/** Pollyroll's classic preset: white plastic, black printed labels. */
export const DEFAULT_DICE_SET: CharacterDiceSet = {
  skin: classic,
  dieScale: 1,
};

export function clampDieScale(value: number): number {
  const stepped = Math.round(value * 20) / 20;
  return Math.min(MAX_DIE_SCALE, Math.max(MIN_DIE_SCALE, stepped));
}

function unit(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : null;
}

function hexColor(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value) ? value : null;
}

function material(value: unknown): Skin['material'] | null {
  if (typeof value === 'string') {
    return MATERIALS.find(name => name === value) ?? null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const metalness = unit(record.metalness);
  const roughness = unit(record.roughness);
  if (metalness === null || roughness === null) return null;
  const params: MaterialParams = { metalness, roughness };
  for (const key of PARAMS) {
    if (key === 'metalness' || key === 'roughness') continue;
    if (record[key] === undefined) continue;
    const parsed = unit(record[key]);
    if (parsed === null) return null;
    params[key] = parsed;
  }
  return params;
}

function skinFrom(value: unknown): Skin | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  const parsedMaterial = material(record.material);
  const labelColor = hexColor(record.labelColor);
  if (parsedMaterial === null || labelColor === null) return null;

  let color: Skin['color'] | null = null;
  if (Array.isArray(record.color)) {
    const a = hexColor(record.color[0]);
    const b = hexColor(record.color[1]);
    if (a === null || b === null || record.color.length !== 2) return null;
    color = [a, b];
  } else {
    color = hexColor(record.color);
  }
  if (color === null) return null;

  const skin: Skin = { material: parsedMaterial, color, labelColor };
  if (record.labelStyle !== undefined) {
    const style = LABEL_STYLES.find(item => item === record.labelStyle);
    if (style === undefined) return null;
    skin.labelStyle = style;
  }
  if (record.pattern !== undefined) {
    const pattern = PATTERNS.find(item => item === record.pattern);
    if (pattern === undefined) return null;
    skin.pattern = pattern;
  }
  if (record.font !== undefined) {
    if (typeof record.font !== 'string' || record.font.length > 80) return null;
    if (record.font !== '') skin.font = record.font;
  }
  return skin;
}

/** Accepts a dice set or a bare skin. Custom GLSL patterns are rejected. */
export function parseDiceSet(input: unknown): CharacterDiceSet | null {
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  const bare = skinFrom(record);
  const wrapped = skinFrom(record.skin);
  const skin = wrapped ?? bare;
  if (skin === null) return null;
  const dieScale =
    typeof record.dieScale === 'number' && Number.isFinite(record.dieScale)
      ? clampDieScale(record.dieScale)
      : DEFAULT_DICE_SET.dieScale;
  return { skin, dieScale };
}
