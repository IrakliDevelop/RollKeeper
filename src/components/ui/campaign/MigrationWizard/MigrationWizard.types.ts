import type { DeviceBackupV1 } from '@/lib/deviceRecovery';
import type {
  DurableFamilyAdapter,
  DurableFamilyName,
  FamilyVerification,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
import type { NormalizedAuthority } from '@/lib/durableDm/familyAuthorityNormalizer';
import type { DmWorkspaceDocument } from '@/lib/indexeddb/dmWorkspaceRepository';

/**
 * Task 14 builds only steps 0 (workspace discovery) and 1 (browser backup).
 * Both render as stacked sections on one page rather than gated behind a real
 * step machine — there is no step 2 (a family) yet to advance to, and the
 * footer's Continue control is unconditionally disabled in this task for
 * exactly that reason (Task 15 wires it up once a family step exists). See
 * the report for the full rationale.
 */
export type RecoveryReceiptStatus =
  | 'pending'
  | 'verified'
  | 'resumed'
  | 'stale';

export interface MigrationRecoveryState {
  status: RecoveryReceiptStatus;
  /**
   * The run's one authoritative bundle. Captured on mount (or on a fresh
   * re-capture after drift, not built by this task), downloaded as-is, and
   * replaced by the verified re-read after a matching file is picked back up.
   */
  bundle: DeviceBackupV1 | null;
  runId: string | null;
  manifestHash: string | null;
  verifiedAt: string | null;
  entryCount: number;
  totalBytes: number;
  error: string | null;
  /**
   * True only while the currently-discovered verified receipt predates the
   * per-entry hash vector (spec R4 / Task 3's `enrichVerifiedDownloadReceiptEntries`).
   * Drives the distinctly-labelled "Check this browser's backup" control.
   */
  needsEnrichment: boolean;
}

export interface MigrationWizardController {
  visible: boolean;
  campaignCode: string;
  /** This run's id: a fresh UUID, or a resumed verified receipt's `runId`. */
  runId: string;
  discovering: boolean;
  discoveryError: string | null;
  workspace: DmWorkspaceDocument | null;
  accountId: string | null;
  discover: () => Promise<void>;
  recovery: MigrationRecoveryState;
  downloadBundle: () => Promise<void>;
  selectBundleFile: (file: File) => Promise<void>;
  enrichLegacyReceipt: () => Promise<void>;
  /**
   * The ONE run-level idempotent remember, spec R10. Every family's
   * `MigrationRunContext` (see `contextFor`) is built with this exact
   * function — never a per-family copy.
   */
  ensureWorkspaceRemembered: () => Promise<void>;
  /**
   * Builds a family's full `MigrationRunContext`. Returns `null` only when
   * workspace discovery has not resolved a workspace yet — `ensureWorkspaceRemembered`
   * itself is still safely callable in that case (it throws its own "sign in
   * first" error), which is what lets a caller reach that guard even before
   * `contextFor` can build a real context.
   */
  contextFor: (family: DurableFamilyName) => MigrationRunContext | null;
  /**
   * Drives one family through `selectFamily` -> `prepareIndexedDb` ->
   * `commitLocalCutover` against the real registered adapter. This is the
   * minimal primitive Task 15's per-family step builds on; it is exercised
   * directly here only by the R10 remember-ordering tests.
   */
  migrate: (family: DurableFamilyName) => Promise<void>;
  /** Derived (never stored): true when any registered family's authority is indexedDB or postgres. */
  anyCutoverCommitted: boolean;
  /**
   * True once `discover()` has resolved (success or failure) at least once
   * this mount. `anyCutoverCommitted` is `false` both when nothing has been
   * cut over AND before discovery has ever run -- a caller (Task 17's route)
   * must not treat those as the same, and this is what lets it tell them
   * apart.
   */
  discoveryAttempted: boolean;

  // -----------------------------------------------------------------------
  // Task 15: per-family step navigation and orchestration. Rail rows are not
  // clickable (settled decision) — navigation is exclusively Back / Continue
  // / Skip, driven by `stepIndex`: -1 is the intro (steps 0/1, unchanged from
  // Task 14), and 0..DURABLE_FAMILY_REGISTRY.length-1 addresses one registry
  // entry (registered or planned) in fixed order.
  // -----------------------------------------------------------------------
  stepIndex: number;
  /** True once the run's one browser backup is verified/resumed (spec R3/R4). Gates Continue past the intro. */
  canContinue: boolean;
  goContinue: () => void;
  goBack: () => void;
  /** `registeredAdapters().length` — the R13 "registered" denominator, live. */
  registeredCount: number;
  /** How many registered families this run has observed at `postgres` authority. Never persisted — rebuilt from `familyAuthorities`. */
  routedCount: number;
  /**
   * The last-observed `NormalizedAuthority` per family, populated lazily as
   * each family's step is visited or acted on. Never a substitute for
   * `deriveFamilyStepState` — FamilyStep still calls that function fresh
   * with this value as one of its inputs, rather than storing a step-state
   * verdict of its own (spec R6).
   */
  familyAuthorities: Partial<Record<DurableFamilyName, NormalizedAuthority>>;
  adapterFor: (family: DurableFamilyName) => DurableFamilyAdapter | null;
  refreshFamilyAuthority: (
    family: DurableFamilyName
  ) => Promise<NormalizedAuthority | null>;
  /**
   * Re-captures the browser backup and compares its manifest hash against
   * the run's one verified receipt (spec R3). Returns the changed key's name
   * on drift, or `null` when the bundle still matches. Never mutates
   * anything — a pure read-and-compare, called both on family-step entry
   * and, again, immediately before each of `selectFamily`,
   * `commitLocalCutover` and `activateCloud` inside `runFamily`.
   */
  checkFamilyDrift: () => Promise<string | null>;
  /**
   * Runs one family through the full chain — drift-checked select, prepare,
   * local cutover, drift-checked cloud activation — from the DM's single
   * typed-confirmation click. Never reverses progress: a cloud failure
   * leaves the family at `indexedDB` authority and returns `cloudFailure`
   * rather than calling `rollback`.
   */
  runFamily: (family: DurableFamilyName) => Promise<FamilyRunOutcome>;
  /** Calls `adapter.repairAuthority`; a REFUSAL (rejection) reads as "still inconsistent, still blocked" (spec R5b). */
  repairFamily: (
    family: DurableFamilyName
  ) => Promise<{ ok: boolean; message: string }>;

  // -----------------------------------------------------------------------
  // Task 16: the final report (spec R8, R13, R14). Verification runs ONLY
  // on entry to the report and on an explicit Refresh -- never on render,
  // never persisted anywhere. Results live in this ephemeral React state and
  // are rebuilt from scratch every time the report is (re-)entered.
  // -----------------------------------------------------------------------
  /**
   * This session's live verification results, keyed by family. Rebuilt from
   * scratch on every winning batch (Task 16 fix round 1, CRITICAL item 1) --
   * never merged with a previous pass's results, so a family that stops
   * appearing here (a rejected `verifyCloud` call, or the family was
   * disabled since the last batch) reads as unverified, never as "still
   * whatever it was last time".
   */
  reportVerifications: Partial<Record<DurableFamilyName, FamilyVerification>>;
  /**
   * Which currently-enabled family's `verifyCloud` call REJECTED on the
   * most recent batch, and the error message. Also rebuilt from scratch
   * every batch.
   */
  reportVerificationErrors: Partial<Record<DurableFamilyName, string>>;
  /** True while the most recent `verifyReport()` call is still in flight. */
  reportVerifying: boolean;
  /**
   * Legacy keys NOT owned by any currently-migrated family whose bytes no
   * longer match the run's one verified bundle (spec R8's sixth condition).
   */
  reportCrossFamilyDrift: string[];
  /**
   * Runs every ENABLED registered family's `verifyCloud` plus the
   * cross-family drift check, guarded by an incrementing request token so a
   * response from a superseded call is discarded rather than applied (spec
   * R14's cancellation and stale-response protection).
   */
  verifyReport: () => Promise<void>;
}

export type FamilyRunOutcome =
  | { outcome: 'success' }
  | { outcome: 'drift'; changedKey: string }
  | { outcome: 'cloudFailure'; reason: string }
  | { outcome: 'error'; message: string };
