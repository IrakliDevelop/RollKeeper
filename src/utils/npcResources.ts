import type { NpcResource, StatBlockEntry } from '@/types/encounter';

/**
 * Form-draft shape: maxUses stays empty until the DM enters it. A draft
 * cannot be saved until isResourceDraftValid passes.
 */
export interface NpcResourceDraft extends Omit<NpcResource, 'maxUses'> {
  maxUses: number | undefined;
}

/** Short rest: 'all' → 0 expended; numeric n → restore up to n uses; 0 → untouched. */
export function applyShortRest(resources: NpcResource[]): NpcResource[] {
  return resources.map(r => {
    if (r.shortRestReset === 'all') return { ...r, usesExpended: 0 };
    if (r.shortRestReset > 0) {
      return {
        ...r,
        usesExpended: Math.max(0, r.usesExpended - r.shortRestReset),
      };
    }
    return r;
  });
}

/** Long rest always restores everything. */
export function applyLongRest(resources: NpcResource[]): NpcResource[] {
  return resources.map(r => ({ ...r, usesExpended: 0 }));
}

export function isResourceDraftValid(d: NpcResourceDraft): boolean {
  const validCore =
    d.name.trim().length > 0 &&
    d.maxUses != null &&
    Number.isInteger(d.maxUses) &&
    d.maxUses >= 1;
  const validReset =
    d.shortRestReset === 'all' ||
    (Number.isInteger(d.shortRestReset) &&
      d.shortRestReset >= 0 &&
      d.maxUses != null &&
      d.shortRestReset <= d.maxUses);
  return validCore && validReset;
}

/** Callers must have validated drafts via isResourceDraftValid first. */
export function finalizeResourceDrafts(
  drafts: NpcResourceDraft[]
): NpcResource[] {
  return drafts.map(d => {
    const maxUses = d.maxUses as number;
    // Defensive normalization of the reset invariant (integer in 0..maxUses).
    const shortRestReset =
      d.shortRestReset === 'all'
        ? ('all' as const)
        : Math.min(
            maxUses,
            Math.max(
              0,
              Math.floor(
                Number.isFinite(d.shortRestReset) ? d.shortRestReset : 0
              )
            )
          );
    return {
      ...d,
      name: d.name.trim(),
      maxUses,
      usesExpended: Math.min(Math.max(0, d.usesExpended), maxUses),
      shortRestReset,
    };
  });
}

/** Defensive save-time cleanup: costs pointing at deleted resources are dropped. */
export function stripDanglingResourceCosts(
  entries: StatBlockEntry[],
  validIds: ReadonlySet<string>
): StatBlockEntry[] {
  return entries.map(e =>
    e.resourceCost && !validIds.has(e.resourceCost.resourceId)
      ? { ...e, resourceCost: undefined }
      : e
  );
}

/** Positive-integer guard shared by form validation and store actions. */
export function isValidResourceAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 1;
}

/** An entry is valid when it has no cost, or its cost amount is a positive integer. */
export function isResourceCostValid(entry: StatBlockEntry): boolean {
  const amount = entry.resourceCost?.amount;
  return amount == null || isValidResourceAmount(amount);
}

/**
 * Normalizes legacy/malformed persisted costs (zero, negative, fractional
 * amounts) to the default of 1 so loading an old NPC never traps the form
 * in an unsaveable state.
 */
export function sanitizeEntryResourceCosts(
  entries: StatBlockEntry[]
): StatBlockEntry[] {
  return entries.map(e =>
    e.resourceCost && !isValidResourceAmount(e.resourceCost.amount)
      ? { ...e, resourceCost: { ...e.resourceCost, amount: 1 } }
      : e
  );
}
