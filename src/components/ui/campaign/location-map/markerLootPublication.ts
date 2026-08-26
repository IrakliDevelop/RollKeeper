import type {
  MarkerDetail,
  MarkerLootLedgerEntry,
  PublicMarkerDetail,
} from '@/types/battlemap';

/** Only public loot containers are seeded; hidden marker definitions stay local. */
export function buildMarkerLootLedger(
  markers: readonly MarkerDetail[],
  publicMarkers: readonly PublicMarkerDetail[]
): MarkerLootLedgerEntry[] {
  const publicRefs = new Set(publicMarkers.map(marker => marker.id));
  return markers.flatMap(marker =>
    !publicRefs.has(marker.id) || marker.deletedAt
      ? []
      : (marker.loot ?? []).map(entry => ({
          markerId: marker.id,
          ...structuredClone(entry),
        }))
  );
}
