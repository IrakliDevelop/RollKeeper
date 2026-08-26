import type { RegistryEntry } from './familyRegistry';
import type { FamilyVerification } from './durableFamilyAdapter';
import type { NormalizedAuthority } from './familyAuthorityNormalizer';
import type { MigrationState } from '@/lib/indexeddb/migrationState';

// Imported from its existing definition (rulings.md R9.1 / D16), never
// re-declared as a fresh, unrelated string literal: typing this against
// `MigrationState` means a future rename or removal of the checkpoint in
// `migrationState.ts` fails this file's compile rather than silently
// desyncing the comparison below.
const CUTOVER_READY_STATE: MigrationState = 'CUTOVER_READY';

/**
 * `notAvailable -> legacy -> selected -> prepared -> indexedDb ->
 * postgresUnverified -> verified`, plus `blocked`, `rolledBack`,
 * `inconsistent` (spec R6).
 */
export type FamilyStepState =
  | 'notAvailable'
  | 'legacy'
  | 'selected'
  | 'prepared'
  | 'indexedDb'
  | 'postgresUnverified'
  | 'verified'
  | 'blocked'
  | 'rolledBack'
  | 'inconsistent';

/**
 * The wizard persists nothing of its own (spec R6): every field here is
 * read from an existing marker, IndexedDB pointer, manifest or recovery
 * receipt, never from wizard-owned state.
 *
 * Precedence, as a sequence of early returns (fixed here; Task 13b's
 * `repairAuthority` inherits this ordering):
 *
 * 1. `notAvailable` — a planned entry, or the family's own client flag is off.
 * 2. `inconsistent` — the normalizer blocked (marker/pointer disagreement).
 * 3. `blocked` — the manifest carries a blocker.
 * 4. Routed authority states — `postgres` (then `verified` or
 *    `postgresUnverified`), then `indexedDB`.
 * 5. `rolledBack` — legacy authority with `rolledBack` set.
 * 6. `prepared` — the persisted `migration-state:<scope>` checkpoint is
 *    `CUTOVER_READY` AND the selection matches this run.
 * 7. `selected` — the selection matches this run.
 * 8. `legacy` — everything else.
 *
 * Returning `legacy` as soon as the authority is legacy would make
 * `selected` and `prepared` unreachable: both are states a family occupies
 * *while still legacy*. The authority check above therefore only returns
 * early for the routed (`postgres`/`indexedDB`) and rolled-back states.
 */
export function deriveFamilyStepState(input: {
  entry: RegistryEntry;
  /** The family's own client flag. A registered-but-disabled family is `notAvailable`. */
  enabled: boolean;
  authority: NormalizedAuthority;
  selection: { runId: string; manifestHash: string } | null;
  runRecovery: { runId: string; manifestHash: string };
  preparedState: string | null;
  blockers: { kind: string }[];
  verification: FamilyVerification | null;
}): FamilyStepState {
  const {
    entry,
    enabled,
    authority,
    selection,
    runRecovery,
    preparedState,
    blockers,
    verification,
  } = input;

  // 1. notAvailable: a planned entry, or the family's own client flag is off.
  if (entry.status === 'planned' || !enabled) return 'notAvailable';

  // 2. inconsistent: the normalizer refused to pick a side.
  if (authority.state === 'inconsistent') return 'inconsistent';

  // 3. blocked: the manifest carries a blocker. This runs BEFORE the routed
  // authority states, so a blocker on an otherwise-verified postgres family
  // still reports blocked.
  if (blockers.length > 0) return 'blocked';

  // 4. Routed authority states.
  if (authority.state === 'postgres') {
    return verification?.verified === true ? 'verified' : 'postgresUnverified';
  }
  if (authority.state === 'indexedDB') return 'indexedDb';

  // From here, authority.state === 'legacy'.

  // 5. rolledBack: legacy authority that got there via a completed rollback.
  if (authority.rolledBack) return 'rolledBack';

  const selectionMatchesRun =
    selection !== null &&
    selection.runId === runRecovery.runId &&
    selection.manifestHash === runRecovery.manifestHash;

  // 6. prepared: the persisted checkpoint says CUTOVER_READY, and the
  // selection backing it is this run's.
  if (preparedState === CUTOVER_READY_STATE && selectionMatchesRun) {
    return 'prepared';
  }

  // 7. selected: the selection matches this run.
  if (selectionMatchesRun) return 'selected';

  // 8. legacy: everything else.
  return 'legacy';
}
