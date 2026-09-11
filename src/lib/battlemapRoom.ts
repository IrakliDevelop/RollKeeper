export const BATTLE_MAP_RELAY_ROOM_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Returns the shared relay room identifier used by every battle-map socket,
 * token, and server-originated poke. Fieldnotes reserves punctuation such as
 * `:` for backend key structure, so the room stays inside its public safe
 * alphabet.
 */
export function battleMapRelayRoom(
  campaignCode: string,
  battleMapId: string
): string {
  const room = `${campaignCode}_${battleMapId}`;
  if (!BATTLE_MAP_RELAY_ROOM_PATTERN.test(room)) {
    throw new RangeError(
      'Battle-map relay room must be 1–64 letters, numbers, underscores, or hyphens'
    );
  }
  return room;
}
