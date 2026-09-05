/** Custom fog materials are strict, bounded, presentation-only values. */
export interface CustomSolidFogMaterialV1 {
  v: 1;
  kind: 'solid';
  /** Normalized `#rrggbb`. Player fill is always this exact opaque color. */
  color: string;
}

export interface CustomProceduralFogMaterialV1 {
  v: 1;
  kind: 'procedural';
  /** Normalized `#rrggbb`; opaque player backdrop. */
  baseColor: string;
  /** Normalized `#rrggbb`; noise tint. */
  noiseColor: string;
  /** Finite 0..1. */
  noiseOpacity: number;
  /** Finite 64..1024 world units per tile repeat. */
  scale: number;
  /** Integer 1..4 octaves. */
  detail: 1 | 2 | 3 | 4;
  /** Integer 0..65535. */
  seed: number;
}

export type CustomFogMaterialV1 =
  | CustomSolidFogMaterialV1
  | CustomProceduralFogMaterialV1;

export interface FogPresetV1 {
  v: 1;
  /** `fp_` + UUID. Never `solid` or `cloudy`. */
  id: string;
  /** Trimmed, 1–60 code points, unique per campaign case-insensitively. */
  name: string;
  material: CustomFogMaterialV1;
  createdAt: string;
  updatedAt: string;
}

/** Stored on a map/location after Apply. Rendering never resolves `sourcePresetId`. */
export interface AppliedCustomFogAppearanceV2 {
  v: 2;
  kind: 'custom';
  sourcePresetId?: string;
  material: CustomFogMaterialV1;
}

/** What player/TV clients receive. Never carries preset ids or names. */
export interface ProjectedCustomFogAppearanceV2 {
  v: 2;
  kind: 'custom';
  material: CustomFogMaterialV1;
}
