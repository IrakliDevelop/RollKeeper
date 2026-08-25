import type { DeviceBackupV1 } from '@/lib/deviceRecovery';
import type {
  DurableFamilyName,
  MigrationRunContext,
} from '@/lib/durableDm/durableFamilyAdapter';
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
}
