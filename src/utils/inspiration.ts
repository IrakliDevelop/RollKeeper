/**
 * Decide whether — and to what — the character page should materialize the
 * campaign's stackable-inspiration house rule onto the character.
 *
 * Returns the boolean to write via `setStackableInspiration`, or `null` when the
 * page must not write:
 *  - solo characters keep their own per-character preference (never overwritten);
 *  - campaign characters wait until the shared state has loaded at least once
 *    (the unknown-until-loaded guard) to avoid clobbering a valid stack.
 */
export function campaignStackableToMaterialize(
  inCampaign: boolean,
  sharedStateLoaded: boolean,
  campaignStackable: boolean | undefined
): boolean | null {
  if (!inCampaign) return null;
  if (!sharedStateLoaded) return null;
  return campaignStackable ?? false;
}
