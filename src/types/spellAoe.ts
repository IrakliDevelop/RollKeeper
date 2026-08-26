/**
 * AoE template geometry for spells — the shapes the battle-map canvas renders.
 *
 * Mapping from 5e rules text:
 *   sphere / radius / cylinder / hemisphere / emanation → 'circle' (sizeFeet = radius)
 *   diameter → 'circle' (sizeFeet = diameter / 2)
 *   cone → 'cone' (sizeFeet = length)
 *   line → 'line' (sizeFeet = length, widthFeet defaults to 5)
 *   wall ("up to X feet long") → 'line'
 *   cube / square → 'square' (sizeFeet = side)
 *
 * NOTE — future canvas SDK shapes: when the canvas gains true cylinder
 * (circle + height), hemisphere/dome, wall (segmented polyline with
 * thickness), or token-attached emanation rendering, extend AoeShape and
 * revisit this mapping. Adding enum values is backward-compatible.
 */
export type AoeShape = 'circle' | 'cone' | 'line' | 'square';

export interface SpellAoe {
  shape: AoeShape;
  /** radius (circle) / length (cone, line) / side (square), in feet */
  sizeFeet: number;
  /** line only; defaults to 5 */
  widthFeet?: number;
}
