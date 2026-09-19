/**
 * Route base for the fog-appearance projection of a map. Deliberately free of
 * SDK imports so the projection hook, the poll callers and their tests can
 * share it without pulling in a viewport.
 */
export type FogAppearanceMapKind = 'battlemap' | 'location';

export function fogAppearanceRouteBase(
  kind: FogAppearanceMapKind,
  campaignCode: string,
  mapId: string
): string {
  const segment = kind === 'location' ? 'locations' : 'battlemaps';
  return `/api/campaign/${encodeURIComponent(campaignCode)}/${segment}/${encodeURIComponent(mapId)}/fog-appearance`;
}

/** The read URL a player surface polls and refetches on a poke. */
export function playerFogAppearanceUrl(
  kind: FogAppearanceMapKind,
  campaignCode: string,
  mapId: string,
  playerId: string
): string {
  return `${fogAppearanceRouteBase(kind, campaignCode, mapId)}?role=player&playerId=${encodeURIComponent(playerId)}`;
}
