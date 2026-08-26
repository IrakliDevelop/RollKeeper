import type { NormalizedAuthority } from './familyAuthorityNormalizer';
import type { DeviceBackupV1 } from '@/lib/deviceRecovery';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';

/**
 * Slice 11G registers exactly these six already-shipped durable data
 * categories.
 */
export type DurableFamilyName =
  | 'campaign_settings'
  | 'calendar'
  | 'magic_item'
  | 'npc'
  | 'encounter_definition'
  | 'combat_log_archive';

export interface MigrationRunContext {
  accountId: string;
  campaignId: string;
  campaignCode: string;
  workspace: DmWorkspaceDocument;
  recovery: DeviceBackupV1;
  /** Idempotent, run-level. Awaited before any local cutover (spec R10). */
  ensureWorkspaceRemembered: () => Promise<void>;
}

/**
 * A manifest handle, not a flattened copy.
 *
 * The six families do not share a manifest shape: `CampaignSettingsManifestRecord`
 * carries `payload` and `references` and has no `tombstoned` field, while
 * `CombatLogArchiveManifestRecord` carries `payload | null` and `tombstoned` and
 * has no references. Flattening to ids and fingerprints would throw away exactly
 * what `commit*LocalCutover` and `stage-items` need, forcing every adapter to
 * rebuild the manifest or cast. So the handle carries a uniform projection for
 * the wizard UI and the activation parity check, plus the family's own manifest
 * untouched in `native` — which only that family's adapter ever reads.
 */
export interface FamilyManifestHandle<TNative = unknown> {
  family: DurableFamilyName;
  fingerprint: string;
  recordCount: number;
  totalBytes: number;
  blockers: { kind: string; legacyId: string | null; detail: string }[];
  records: {
    legacyId: string;
    schemaVersion: number;
    byteCount: number;
    payloadFingerprint: string;
    /** `false` for families whose manifest has no tombstone concept. */
    tombstoned: boolean;
    /** `[]` for families with no typed cross-family references. */
    references: { family: string; legacyId: string }[];
  }[];
  native: TNative;
}

export interface FamilyConfirmation {
  familyLabel: string;
  campaignLabel: string;
  manifestFingerprint: string;
  requiredPhrase: string;
}

/**
 * The closed set of reasons a cloud activation can refuse. Every one of them
 * is produced by `runResumableCloudActivation` and passed straight through by
 * all six adapters, so this union — NOT a bare `string` — is what the wizard
 * receives.
 *
 * Final fix wave, F1: it was `string`, which let the wizard's own test stub
 * return polished prose while production returned an internal token, and made
 * `type-check` unable to tell the two apart. The four members below are
 * internal discriminants, never product copy: every render site MUST map them
 * through `cloudActivationFailureMessage`
 * (`src/components/ui/campaign/MigrationWizard/migrationCopy.ts`).
 */
export type CloudActivationConflictReason =
  | 'cloud-generation-diverged'
  | 'cloud-epoch-unknown'
  | 'cloud-epoch-unexpected'
  | 'cloud-preview-unusable';

export type CloudActivationOutcome =
  | { status: 'activated' | 'reconciled'; epoch: number }
  | { status: 'conflict'; reason: CloudActivationConflictReason };

/**
 * Compares legacyId, payloadFingerprint AND schemaVersion. `verifyCloud` is
 * implemented in each adapter's own task, not deferred: the interface requires
 * it from Task 7 onward, so the conformance suite's verification tests can run
 * against every adapter that lands.
 */
export interface FamilyVerification {
  authorityAgrees: boolean;
  cloudAuthority: 'legacy' | 'postgres';
  epoch: number;
  recordCount: number;
  documentsMatch: boolean;
  tombstonesMatch: boolean;
  /**
   * Settled state, not an empty table: zero NON-TERMINAL outbox entries.
   * Acknowledged and superseded rows are history and stay. Requiring physical
   * emptiness would make a correctly synced device permanently unverifiable.
   */
  outboxEmpty: boolean;
  /**
   * UNRESOLVED conflicts only. A preserved device candidate is recoverable data
   * the program exists to protect; counting it here would make origin B
   * permanently unverifiable after any legitimate divergence.
   */
  conflictCount: number;
  verified: boolean;
}

/**
 * Every method below is `this`-bound: several call other methods on the
 * SAME adapter instance internally (e.g. `activateCloud` calls
 * `this.readAuthority`, and `readAuthority` calls `this.isVisible`). A
 * caller MUST invoke methods on the adapter object itself
 * (`adapter.readAuthority(ctx)`), never through a destructured or otherwise
 * detached reference (`const { readAuthority } = adapter; readAuthority(ctx)`
 * throws) — the pattern a wizard passing a method as a bare callback would
 * reach for first.
 */
export interface DurableFamilyAdapter<TNative = unknown> {
  family: DurableFamilyName;
  label: string;
  isVisible(): boolean;
  previewManifest(
    context: MigrationRunContext
  ): Promise<FamilyManifestHandle<TNative>>;
  confirmation(
    context: MigrationRunContext,
    manifest: FamilyManifestHandle<TNative>
  ): FamilyConfirmation;
  selectFamily(context: MigrationRunContext): Promise<void>;
  prepareIndexedDb(context: MigrationRunContext): Promise<{
    state: string;
    generation: string;
    manifest: FamilyManifestHandle<TNative>;
  }>;
  commitLocalCutover(
    context: MigrationRunContext,
    input: { generation: string; manifest: FamilyManifestHandle<TNative> }
  ): Promise<{ epoch: number }>;
  /**
   * Runs the cloud half AND the local half: staging and confirmation through
   * `runResumableCloudActivation`, then `mark*CloudAuthority` to rebase the
   * accepted document versions and drain the outbox rows, then the family's
   * localStorage authority marker. Returning after the server call alone would
   * leave the account Postgres-authoritative while the device still believes it
   * is IndexedDB-authoritative.
   */
  activateCloud(
    context: MigrationRunContext,
    manifest: FamilyManifestHandle<TNative>
  ): Promise<CloudActivationOutcome>;
  verifyCloud(context: MigrationRunContext): Promise<FamilyVerification>;
  readAuthority(
    context: Pick<
      MigrationRunContext,
      'accountId' | 'campaignId' | 'campaignCode'
    >
  ): Promise<NormalizedAuthority>;
  rollback(context: MigrationRunContext): Promise<{ epoch: number }>;
  /**
   * Task 13b, ruling R7.3: the interface's final member, added together
   * with all six implementations in one commit so no intermediate state
   * ships without it. Resolves a `readAuthority` result of `inconsistent`
   * per spec R5b's decision table (`src/lib/durableDm/authorityRepair.ts`
   * makes the decision; this method gathers the family-specific evidence
   * and performs the write). A no-op that returns the current
   * `NormalizedAuthority` unchanged when there is nothing to repair.
   * REFUSES — rejects rather than resolving to a lying "fixed" state — when
   * R5b's evidence does not support a repair, so a caller must never treat
   * a rejection as anything other than "still inconsistent, still blocked".
   */
  repairAuthority(
    context: Pick<
      MigrationRunContext,
      'accountId' | 'campaignId' | 'campaignCode'
    >
  ): Promise<NormalizedAuthority>;
}
