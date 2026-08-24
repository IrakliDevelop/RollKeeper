import type { NormalizedAuthority } from './familyAuthorityNormalizer';
import type { DeviceBackupV1 } from '@/lib/deviceRecovery';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';

/**
 * Slice 11G registers exactly these six already-shipped durable data
 * categories. `repairAuthority` (spec R1's final surface member) is
 * deliberately absent from `DurableFamilyAdapter` below: Task 13b adds it,
 * plus all six implementations, in one commit (rulings R7.3, C3). Declaring it
 * earlier would make every Task 7-12 commit fail to satisfy the interface
 * before an implementation exists.
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

export type CloudActivationOutcome =
  | { status: 'activated' | 'reconciled'; epoch: number }
  | { status: 'conflict'; reason: string };

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
}
