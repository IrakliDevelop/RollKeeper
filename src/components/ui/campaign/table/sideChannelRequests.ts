/**
 * The one wire shape for map-keyed side channels (PR04 Q4/C4-2). Clients
 * build every marker, loot, fog-appearance and battle-map metadata request
 * here, and the route tests replay these exact requests, so a client/server
 * mismatch (missing credential, CSRF header or body field) fails a test.
 * Under Table v1 the server verifies the claimed credential; with v1 off the
 * credential query parameters are ignored.
 */
export type SideChannelCredential =
  | { role: 'dm'; dmId: string }
  | { role: 'player'; playerId: string }
  /** Table v1 off: the legacy map-pinned display key (query). */
  | { role: 'display'; displayKey: string }
  /** Table v1 (PR05 E5): capability + bound session nonce, headers only. */
  | { role: 'display'; capability: string; nonce: string };

/** PR05 E5: display credential headers for side-channel GETs (v1). */
export const DISPLAY_CAPABILITY_HEADER = 'x-rollkeeper-display-capability';
export const DISPLAY_SESSION_HEADER = 'x-rollkeeper-display-session';

export interface SideChannelRequest {
  url: string;
  init: RequestInit;
}

const MUTATION_HEADERS = {
  'Content-Type': 'application/json',
  'x-rollkeeper-csrf': '1',
} as const;

const campaignBase = (campaignCode: string) =>
  `/api/campaign/${encodeURIComponent(campaignCode)}`;

export function sideChannelCredentialQuery(
  credential: SideChannelCredential
): string {
  const params = new URLSearchParams({ role: credential.role });
  if (credential.role === 'dm') params.set('dmId', credential.dmId);
  else if (credential.role === 'player')
    params.set('playerId', credential.playerId);
  else if ('displayKey' in credential)
    params.set('displayKey', credential.displayKey);
  return params.toString();
}

/**
 * The fetch init for a side-channel GET. A v1 display credential travels in
 * headers (never the query, so it cannot reach logs or a Referer) with the
 * CSRF header the server's same-origin read check requires.
 */
export function sideChannelReadInit(
  credential: SideChannelCredential
): RequestInit {
  if (credential.role !== 'display' || !('capability' in credential)) return {};
  return {
    headers: {
      [DISPLAY_CAPABILITY_HEADER]: credential.capability,
      [DISPLAY_SESSION_HEADER]: credential.nonce,
      'x-rollkeeper-csrf': '1',
    },
  };
}

export function battleMapListUrl(
  campaignCode: string,
  credential: SideChannelCredential
): string {
  return `${campaignBase(campaignCode)}/battlemaps?${sideChannelCredentialQuery(credential)}`;
}

export function battleMapDetailUrl(
  campaignCode: string,
  mapId: string,
  credential: SideChannelCredential
): string {
  return `${campaignBase(campaignCode)}/battlemaps/${encodeURIComponent(mapId)}?${sideChannelCredentialQuery(credential)}`;
}

export function battleMapDeleteRequest(
  campaignCode: string,
  mapId: string,
  dmId: string
): SideChannelRequest {
  return {
    url: `${campaignBase(campaignCode)}/battlemaps/${encodeURIComponent(mapId)}`,
    init: {
      method: 'DELETE',
      headers: { ...MUTATION_HEADERS },
      body: JSON.stringify({ dmId }),
    },
  };
}

const markersBase = (campaignCode: string, mapId: string) =>
  `${campaignBase(campaignCode)}/battlemaps/${encodeURIComponent(mapId)}/markers`;

export function markerDetailsUrl(
  campaignCode: string,
  mapId: string,
  credential: SideChannelCredential
): string {
  return `${markersBase(campaignCode, mapId)}?${sideChannelCredentialQuery(credential)}`;
}

export function markerPublishRequest(
  campaignCode: string,
  mapId: string,
  body: { dmId: string; markers: unknown; loot: unknown }
): SideChannelRequest {
  return {
    url: markersBase(campaignCode, mapId),
    init: {
      method: 'PUT',
      headers: { ...MUTATION_HEADERS },
      body: JSON.stringify(body),
    },
  };
}

export function lootClaimRequest(
  campaignCode: string,
  mapId: string,
  body: {
    playerId: string;
    markerId: string;
    entryId: string;
    quantity: number;
    requestId: string;
  }
): SideChannelRequest {
  return {
    url: markersBase(campaignCode, mapId),
    init: {
      method: 'POST',
      headers: { ...MUTATION_HEADERS },
      body: JSON.stringify(body),
    },
  };
}

export function fogAppearanceReadUrl(
  kind: 'battlemap' | 'location',
  campaignCode: string,
  mapId: string,
  credential: SideChannelCredential
): string {
  const segment = kind === 'location' ? 'locations' : 'battlemaps';
  return `${campaignBase(campaignCode)}/${segment}/${encodeURIComponent(mapId)}/fog-appearance?${sideChannelCredentialQuery(credential)}`;
}
