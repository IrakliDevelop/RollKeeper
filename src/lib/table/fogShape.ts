/**
 * Repair 10 (G1): fog has two shapes.
 *
 * - The editor (Viewport fog plugin, `FogStateV1`, the scene's localDraft
 *   and offline slot): `{ definition, tiles: [{ x, y, data }] }`.
 * - The live room (authority fog extension, `FogSnapshot`, saved
 *   checkpoints): `{ meta: { version, editor, definition? }, tiles:
 *   [{ generation, x, y, version, editor, data? }] }`, tiles sorted by x
 *   then y.
 *
 * Sending the editor shape to the room was refused (400: "the saved copy
 * can't be used", and a fogged map could never go live); loading the room
 * shape into the editor failed the fog plugin's validation.
 */

type Fields = Record<string, unknown>;

function fields(value: unknown): Fields | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Fields)
    : null;
}

const byPosition = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => (a.x !== b.x ? a.x - b.x : a.y - b.y);

/**
 * Editor fog → authority fog snapshot. Null or missing stays null; a value
 * that is already authority-shaped (`meta`) is returned as is, and so is an
 * editor value with a malformed or repeated tile (fail closed). Every record
 * gets version 1 and `editor` (the DM id): the room starts from this state
 * and clients continue numbering from the highest version they see.
 */
export function editorFogToAuthorityFog(
  value: unknown,
  editor: string
): unknown {
  const fog = fields(value);
  if (!fog) return null;
  if (fields(fog.meta)) return structuredClone(fog);
  const definition = fields(fog.definition);
  if (!definition) return null;
  // OO3: fail closed. A malformed or repeated tile makes the whole value go
  // to the room unchanged, which refuses it; dropping a tile instead would
  // show a concealed area on a revealed map.
  const source = Array.isArray(fog.tiles) ? fog.tiles : [];
  const seen = new Set<string>();
  const tiles: Array<{
    generation: unknown;
    x: number;
    y: number;
    version: number;
    editor: string;
    data?: string;
  }> = [];
  for (const item of source) {
    const tile = fields(item);
    if (!tile || !Number.isSafeInteger(tile.x) || !Number.isSafeInteger(tile.y))
      return structuredClone(fog);
    const key = `${tile.x as number},${tile.y as number}`;
    if (seen.has(key)) return structuredClone(fog);
    seen.add(key);
    tiles.push({
      generation: definition.generation,
      x: tile.x as number,
      y: tile.y as number,
      version: 1,
      editor,
      ...(typeof tile.data === 'string' ? { data: tile.data } : {}),
    });
  }
  tiles.sort(byPosition);
  return {
    meta: { version: 1, editor, definition: structuredClone(definition) },
    tiles,
  };
}

/**
 * Authority fog snapshot → editor fog, as the live connection loads it
 * (`battlemapAuthority`): no definition means no fog, and tiles without
 * data are base tiles the editor leaves out. Editor-shaped fog is returned
 * as is.
 */
export function authorityFogToEditorFog(value: unknown): unknown {
  const fog = fields(value);
  if (!fog) return null;
  const meta = fields(fog.meta);
  if (!meta) return structuredClone(fog);
  const definition = fields(meta.definition);
  if (!definition) return null;
  const tiles = (Array.isArray(fog.tiles) ? fog.tiles : [])
    .flatMap(item => {
      const tile = fields(item);
      return tile &&
        Number.isSafeInteger(tile.x) &&
        Number.isSafeInteger(tile.y) &&
        typeof tile.data === 'string'
        ? [{ x: tile.x as number, y: tile.y as number, data: tile.data }]
        : [];
    })
    .sort(byPosition);
  return { definition: structuredClone(definition), tiles };
}
