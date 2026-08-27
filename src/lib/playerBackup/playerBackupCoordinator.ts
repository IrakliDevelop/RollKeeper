import {
  type DeviceBackupEntryVectorItem,
  type DeviceBackupV1,
  type RecoveryDownloadReceipt,
  captureDeviceBackup,
  computeManifestHash,
  deviceBackupEntryVectorsEqual,
} from '@/lib/deviceRecovery';
import {
  inspectCurrentCharacterSafetyCoverage,
  readCharacterActivationEvidence,
  readCharacterAuthority,
} from '@/lib/indexeddb/characterAuthority';
import {
  characterCutoverSelectionKey,
  assertCharacterCutoverSelectionActivation,
  markCharacterCutoverActivated,
  readCharacterCutoverSelection,
  rebindCharacterCutoverSelection,
  repairCharacterCutoverActivationFromEvidence,
  selectCharacterCutover,
} from '@/lib/indexeddb/characterCutoverSelection';
import { activatePreparedCharacterCutover } from '@/lib/indexeddb/characterCutoverControl';
import { bootstrapCharacterPersistence } from '@/lib/indexeddb/characterPersistenceBootstrap';
import { captureActiveCharacterRecoveryBundle } from '@/lib/indexeddb/characterRecoveryExport';
import {
  openExistingRollkeeperDatabase,
  openRollkeeperDatabase,
} from '@/lib/indexeddb/localDatabase';
import { withMigrationLock } from '@/lib/indexeddb/migrationLock';
import { AutomaticCharacterSyncPreferences } from '@/lib/supabase/automaticCharacterSyncPreferences';

import type { CharacterCloudLinkRepository } from '@/lib/supabase/characterCloudLinks';

import type { PlayerBackupCloudPreview } from './playerBackupCloudPreview';
import type { PlayerBackupConflictListing } from './playerBackupConflictCoordinator';
import {
  PlayerBackupCloudPreviewController,
  PlayerBackupCloudPreviewError,
} from './playerBackupCloudPreview';
import type { PlayerBackupExecutionResult } from './playerBackupOnlineExecution';
import { rebindPlayerBackupActiveSelection } from './playerBackupActiveSelection';
import { classifyDegradedEligibility } from './playerBackupEligibility';
import {
  advancePlayerBackupRunToLocalReady,
  type PlayerBackupAuthoritySnapshot,
  type PlayerBackupExecutionPath,
  type PlayerBackupRunV1,
  playerBackupExecutionPath,
  readActivePlayerBackupRun,
} from './playerBackupRunRepository';
import {
  compareProtectedSourceEntries,
  assertFreshVerifiedBroadSafetyFile,
  verifyFreshCurrentCharacterBundle,
} from './playerBackupSafety';
import {
  type PlayerBackupExclusiveLockProvider,
  assertActivePlayerBackupRun,
  withPlayerBackupAccountLock,
} from './playerBackupRunFence';

/** Read-only foundation controller. Mutation orchestration begins in Task 5. */
export class PlayerBackupReadOnlyCoordinator {
  readonly cloud = new PlayerBackupCloudPreviewController();
  private accountId: string | null = null;
  private run: PlayerBackupRunV1 | null = null;
  private resultToken = 0;
  private result: PlayerBackupExecutionResult | null = null;
  private resultLoading = false;
  private conflictToken = 0;
  private conflicts: PlayerBackupConflictListing | null = null;
  private conflictsLoading = false;

  changeAccount(accountId: string | null): void {
    this.accountId = accountId;
    this.run = null;
    this.resultToken += 1;
    this.result = null;
    this.resultLoading = false;
    this.conflictToken += 1;
    this.conflicts = null;
    this.conflictsLoading = false;
    this.cloud.changeAccount(accountId);
  }

  snapshot() {
    return {
      accountId: this.accountId,
      run: this.run,
      cloud: this.cloud.snapshot(),
      result: this.result,
      resultLoading: this.resultLoading,
      conflicts: this.conflicts,
      conflictsLoading: this.conflictsLoading,
    };
  }

  async discoverRun(
    factory?: IDBFactory | null
  ): Promise<PlayerBackupRunV1 | null> {
    const accountId = this.accountId;
    if (!accountId) return null;
    const run = await readActivePlayerBackupRun({ accountId, factory });
    if (this.accountId === accountId) this.run = run;
    return this.accountId === accountId ? run : null;
  }

  loadCloud(
    accountId: string,
    loader: () => Promise<PlayerBackupCloudPreview>
  ): Promise<boolean> {
    if (this.accountId !== accountId) this.changeAccount(accountId);
    return this.cloud.load(accountId, loader);
  }

  /**
   * Mirrors `cloud.load`'s token/account guard: a result is applied only when
   * this call's token and account are still current and the loaded result's
   * own `accountId` matches. `changeAccount` bumps the token synchronously, so
   * a result that resolves after the account switched is discarded.
   */
  async loadResult(
    accountId: string,
    loader: () => Promise<PlayerBackupExecutionResult>
  ): Promise<boolean> {
    if (this.accountId !== accountId) this.changeAccount(accountId);
    const requestToken = ++this.resultToken;
    this.resultLoading = true;
    try {
      const result = await loader();
      if (
        requestToken !== this.resultToken ||
        this.accountId !== accountId ||
        result.accountId !== accountId
      ) {
        return false;
      }
      this.result = result;
      this.resultLoading = false;
      return true;
    } catch (cause) {
      if (requestToken !== this.resultToken || this.accountId !== accountId) {
        return false;
      }
      this.resultLoading = false;
      throw cause;
    }
  }

  /** Mirrors `loadResult`'s token/account guard for the conflict listing. */
  async loadConflicts(
    accountId: string,
    loader: () => Promise<PlayerBackupConflictListing>
  ): Promise<boolean> {
    if (this.accountId !== accountId) this.changeAccount(accountId);
    const requestToken = ++this.conflictToken;
    this.conflictsLoading = true;
    try {
      const listing = await loader();
      if (
        requestToken !== this.conflictToken ||
        this.accountId !== accountId ||
        listing.accountId !== accountId
      ) {
        return false;
      }
      this.conflicts = listing;
      this.conflictsLoading = false;
      return true;
    } catch (cause) {
      if (requestToken !== this.conflictToken || this.accountId !== accountId) {
        return false;
      }
      this.conflictsLoading = false;
      throw cause;
    }
  }
}

interface PlayerBackupVerifiedReceiptStore {
  hasVerifiedDownloadReceipt(manifestHash: string): Promise<boolean>;
  readVerifiedDownloadReceipt(
    manifestHash: string
  ): Promise<RecoveryDownloadReceipt | null>;
}

function protectedEntries(
  entries: readonly DeviceBackupV1['entries'][number][],
  authority: PlayerBackupAuthoritySnapshot
) {
  const selectionKey = characterCutoverSelectionKey(authority.namespace);
  return entries.filter(entry => entry.key !== selectionKey);
}

async function protectedEntryDigest(
  bundle: DeviceBackupV1,
  authority: PlayerBackupAuthoritySnapshot
): Promise<string> {
  return computeManifestHash(protectedEntries(bundle.entries, authority));
}

export class PlayerBackupEligibilityChangedError extends Error {
  readonly name = 'PlayerBackupEligibilityChangedError';

  constructor(readonly changedCharacterIds: string[]) {
    super('Online eligibility changed before confirmation');
  }
}

export async function confirmPlayerBackupConsent(options: {
  factory: IDBFactory;
  storage: Storage;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  receipts: PlayerBackupVerifiedReceiptStore;
  accountId: string;
  expectedActiveRunId: string | null;
  runId: string;
  mode: 'one-time' | 'ongoing';
  eligibleCharacterIds: string[];
  selectedCharacterIds: string[];
  clearedCharacterIds: string[];
  broadSafetyBundle: DeviceBackupV1;
  currentCharacterSafetyBundle?: Awaited<
    ReturnType<typeof captureActiveCharacterRecoveryBundle>
  >;
  authority: PlayerBackupAuthoritySnapshot;
  confirmedAt: string;
  executionPath?: PlayerBackupExecutionPath;
  /**
   * Awaited as the first statement inside the account lock, before any safety
   * read or database open, so a throw leaves the confirmation without writes.
   */
  recheckUnderLock?: () => Promise<void>;
}): Promise<PlayerBackupRunV1> {
  return withPlayerBackupAccountLock(
    { accountId: options.accountId, locks: options.locks },
    async () => {
      if (options.recheckUnderLock) await options.recheckUnderLock();
      await assertFreshVerifiedBroadSafetyFile({
        bundle: options.broadSafetyBundle,
        storage: options.storage,
        receipts: options.receipts,
      });
      if (options.authority.kind === 'indexedDB') {
        const coverage = await inspectCurrentCharacterSafetyCoverage({
          factory: options.factory,
          storage: options.storage,
          namespace: options.authority.namespace,
          expectedAuthority: options.authority,
        });
        if (options.currentCharacterSafetyBundle) {
          await verifyFreshCurrentCharacterBundle({
            expected: options.currentCharacterSafetyBundle,
            factory: options.factory,
            namespace: options.authority.namespace,
            receipts: options.receipts,
          });
        } else if (!coverage.broadFileCoversCurrentCharacters) {
          throw new Error(
            'Verified current character safety coverage is required'
          );
        }
        const database = await openExistingRollkeeperDatabase({
          factory: options.factory,
        });
        if (!database) throw new Error('Active character authority is missing');
        try {
          const evidence = await readCharacterActivationEvidence(
            database,
            options.authority.namespace,
            options.authority.generation
          );
          assertCharacterCutoverSelectionActivation({
            selection: readCharacterCutoverSelection(
              options.storage,
              options.authority.namespace
            ),
            evidence,
            namespace: options.authority.namespace,
            generation: options.authority.generation,
            epoch: options.authority.epoch,
          });
        } finally {
          database.close();
        }
      } else if (
        readCharacterCutoverSelection(
          options.storage,
          options.authority.namespace
        ) !== null
      ) {
        throw new Error('Legacy character authority has an orphan selection');
      }
      const run: PlayerBackupRunV1 = {
        version: 1,
        runId: options.runId,
        accountId: options.accountId,
        namespace: `user:${options.accountId}`,
        mode: options.mode,
        eligibleCharacterIds: structuredClone(options.eligibleCharacterIds),
        selectedCharacterIds: structuredClone(options.selectedCharacterIds),
        clearedCharacterIds: structuredClone(options.clearedCharacterIds),
        futureDefault: options.mode === 'ongoing' ? 'on' : 'off',
        broadSafetyReceipt: {
          runId: options.broadSafetyBundle.runId,
          manifestHash: options.broadSafetyBundle.manifestHash,
          createdAt: options.broadSafetyBundle.createdAt,
          protectedEntryDigest: await protectedEntryDigest(
            options.broadSafetyBundle,
            options.authority
          ),
        },
        ...(options.currentCharacterSafetyBundle
          ? {
              currentCharacterSafetyReceipt: {
                runId: options.currentCharacterSafetyBundle.bundle.runId,
                manifestHash:
                  options.currentCharacterSafetyBundle.bundle.manifestHash,
                createdAt:
                  options.currentCharacterSafetyBundle.bundle.createdAt,
                entryVectorDigest:
                  options.currentCharacterSafetyBundle.bundle.manifestHash,
                authorityGeneration:
                  options.currentCharacterSafetyBundle.authority.generation,
                authorityEpoch:
                  options.currentCharacterSafetyBundle.authority.epoch,
              },
            }
          : {}),
        authority: structuredClone(options.authority),
        confirmedAt: options.confirmedAt,
        stage: 'confirmed',
        ...(options.executionPath
          ? { executionPath: options.executionPath }
          : {}),
        characterCheckpoints: Object.fromEntries(
          options.selectedCharacterIds.map(id => [
            id,
            { localPreparation: 'pending' as const },
          ])
        ),
      };
      const database = await openRollkeeperDatabase({
        factory: options.factory,
      });
      try {
        const preferences = new AutomaticCharacterSyncPreferences(database);
        await preferences.applyConfirmedSelection({
          expectedActiveRunId: options.expectedActiveRunId,
          run,
          confirmed: true,
        });
        const acknowledged = await preferences.readConfirmedSelection(
          run.namespace,
          run.eligibleCharacterIds
        );
        const expectedPolicies = Object.fromEntries([
          ...run.selectedCharacterIds.map(id => [
            id,
            run.mode === 'ongoing' ? 'on' : 'off',
          ]),
          ...run.clearedCharacterIds.map(id => [id, 'off']),
        ]);
        if (
          Object.keys(acknowledged.characterPolicies).length !==
            run.eligibleCharacterIds.length ||
          run.eligibleCharacterIds.some(
            id => acknowledged.characterPolicies[id] !== expectedPolicies[id]
          ) ||
          acknowledged.futureDefault !== run.futureDefault ||
          acknowledged.confirmedAt !== run.confirmedAt
        ) {
          throw new Error(
            'Durable player backup consent could not be acknowledged'
          );
        }
      } finally {
        database.close();
      }
      return run;
    }
  );
}

/**
 * Confirms a one-time degraded manual run. The eligibility recheck runs inside
 * the account lock before any write, so a contested character aborts the whole
 * confirmation.
 */
export async function confirmDegradedPlayerBackupConsent(
  options: Omit<
    Parameters<typeof confirmPlayerBackupConsent>[0],
    'mode' | 'executionPath' | 'recheckUnderLock'
  > & {
    preview: () => Promise<PlayerBackupCloudPreview>;
    links: CharacterCloudLinkRepository;
  }
): Promise<PlayerBackupRunV1> {
  const { preview, links, ...consent } = options;
  return confirmPlayerBackupConsent({
    ...consent,
    mode: 'one-time',
    executionPath: 'degraded-manual',
    recheckUnderLock: async () => {
      const fresh = await preview();
      if (fresh.account.id !== consent.accountId) {
        throw new PlayerBackupCloudPreviewError('account-changed');
      }
      const snapshot = classifyDegradedEligibility({ preview: fresh, links });
      const changed = consent.selectedCharacterIds.filter(
        id => !snapshot.eligibleCharacterIds.includes(id)
      );
      if (changed.length) {
        throw new PlayerBackupEligibilityChangedError(changed);
      }
      const present = new Set(fresh.characters.map(entry => entry.legacyId));
      const absent = [
        ...new Set([
          ...consent.clearedCharacterIds,
          ...consent.eligibleCharacterIds,
        ]),
      ].filter(id => !present.has(id));
      if (absent.length) {
        throw new PlayerBackupEligibilityChangedError(absent);
      }
    },
  });
}

async function verifiedReceiptEntries(
  run: PlayerBackupRunV1,
  receipts: PlayerBackupVerifiedReceiptStore
): Promise<readonly DeviceBackupEntryVectorItem[]> {
  if (
    !(await receipts.hasVerifiedDownloadReceipt(
      run.broadSafetyReceipt.manifestHash
    ))
  ) {
    throw new Error('Verified broad safety receipt is missing');
  }
  const receipt = await receipts.readVerifiedDownloadReceipt(
    run.broadSafetyReceipt.manifestHash
  );
  if (
    !receipt ||
    receipt.runId !== run.broadSafetyReceipt.runId ||
    !receipt.entries
  ) {
    throw new Error('Verified broad safety receipt entries are missing');
  }
  return receipt.entries;
}

async function assertCommittedProtectedSource(options: {
  run: PlayerBackupRunV1;
  receipts: PlayerBackupVerifiedReceiptStore;
  storage: Storage;
  appVersion: string;
}): Promise<{
  before: readonly DeviceBackupEntryVectorItem[];
  after: DeviceBackupV1;
}> {
  const before = await verifiedReceiptEntries(options.run, options.receipts);
  const after = await captureDeviceBackup(options.storage, {
    appVersion: options.appVersion,
    runId: options.run.broadSafetyReceipt.runId,
    timestamp: options.run.broadSafetyReceipt.createdAt,
  });
  const selectionKey = characterCutoverSelectionKey(
    options.run.authority.namespace
  );
  const beforeProtected = before.filter(entry => entry.key !== selectionKey);
  const afterProtected = after.entries.filter(
    entry => entry.key !== selectionKey
  );
  if (!deviceBackupEntryVectorsEqual(beforeProtected, afterProtected)) {
    throw new Error('The protected source changed after confirmation');
  }
  if (
    (await computeManifestHash(afterProtected)) !==
    options.run.broadSafetyReceipt.protectedEntryDigest
  ) {
    throw new Error('The protected source digest changed after confirmation');
  }
  return { before, after };
}

async function verifyCurrentCharacterReceipt(options: {
  run: PlayerBackupRunV1;
  receipts: PlayerBackupVerifiedReceiptStore;
  factory: IDBFactory;
}): Promise<boolean> {
  const receipt = options.run.currentCharacterSafetyReceipt;
  if (!receipt) return false;
  if (
    !(await options.receipts.hasVerifiedDownloadReceipt(receipt.manifestHash))
  ) {
    throw new Error('Verified current character safety receipt is missing');
  }
  const fresh = await captureActiveCharacterRecoveryBundle({
    factory: options.factory,
    namespace: options.run.authority.namespace,
    appVersion: 'player-backup-resume',
    runId: receipt.runId,
    timestamp: receipt.createdAt,
    expectedAuthority: {
      generation: receipt.authorityGeneration,
      epoch: receipt.authorityEpoch,
    },
  });
  if (
    fresh.bundle.manifestHash !== receipt.manifestHash ||
    fresh.bundle.manifestHash !== receipt.entryVectorDigest
  ) {
    throw new Error('Current character safety evidence changed');
  }
  return true;
}

async function readCurrentRun(
  accountId: string,
  factory: IDBFactory
): Promise<PlayerBackupRunV1> {
  const run = await readActivePlayerBackupRun({ accountId, factory });
  if (!run) throw new Error('Committed player backup run is missing');
  return run;
}

const ALREADY_LOCKED_MIGRATION = {
  request: async <T>(
    _name: string,
    _options: { mode: 'exclusive' },
    callback: () => Promise<T> | T
  ): Promise<T> => callback(),
};

export async function continuePlayerBackupLocalPreparation(options: {
  factory: IDBFactory;
  storage: Storage;
  locks: PlayerBackupExclusiveLockProvider | null | undefined;
  receipts: PlayerBackupVerifiedReceiptStore;
  accountId: string;
  appVersion: string;
  ownerId: string;
  now: () => string;
  nowMs: () => number;
  storageManager?: {
    estimate(): Promise<{ quota?: number; usage?: number }>;
    persist(): Promise<boolean>;
  };
}): Promise<PlayerBackupRunV1> {
  const discovered = await readCurrentRun(options.accountId, options.factory);
  if (playerBackupExecutionPath(discovered) === 'degraded-manual') {
    throw new Error('Degraded manual backup never prepares local authority');
  }
  if (discovered.stage === 'local-ready') return discovered;

  if (discovered.authority.kind === 'indexedDB') {
    const currentCharacterSafetyVerified = await verifyCurrentCharacterReceipt({
      run: discovered,
      receipts: options.receipts,
      factory: options.factory,
    });
    let ready: PlayerBackupRunV1 | null = null;
    await rebindPlayerBackupActiveSelection({
      factory: options.factory,
      storage: options.storage,
      namespace: discovered.authority.namespace,
      accountId: options.accountId,
      expectedActiveRunId: discovered.runId,
      authorizedAt: discovered.confirmedAt,
      expectedAuthority: discovered.authority,
      currentCharacterSafetyVerified,
      locks: options.locks,
      ownerId: options.ownerId,
      nowMs: options.nowMs,
      verifyConsentSafety: async () => {
        await assertCommittedProtectedSource({
          run: discovered,
          receipts: options.receipts,
          storage: options.storage,
          appVersion: options.appVersion,
        });
      },
      onVerifiedRebind: async (selection, authority, database) => {
        ready = await advancePlayerBackupRunToLocalReady(database, {
          accountId: options.accountId,
          expectedActiveRunId: discovered.runId,
          authority: {
            kind: 'indexedDB',
            namespace: authority.namespace,
            family: authority.family,
            generation: authority.generation,
            epoch: authority.epoch,
          },
          selectionAuthorizedAt: selection.playerBackupAuthorizedAt!,
          verifiedAt: options.now(),
        });
      },
    });
    if (!ready)
      throw new Error('Active character selection was not acknowledged');
    return ready;
  }

  return withPlayerBackupAccountLock(
    { accountId: options.accountId, locks: options.locks },
    async () => {
      await assertActivePlayerBackupRun({
        accountId: options.accountId,
        expectedActiveRunId: discovered.runId,
        factory: options.factory,
      });
      const run = await readCurrentRun(options.accountId, options.factory);
      if (run.runId !== discovered.runId) {
        throw new Error('The active player backup run was replaced');
      }
      const database = await openExistingRollkeeperDatabase({
        factory: options.factory,
      });
      if (!database)
        throw new Error('Committed player backup database is missing');
      try {
        return await withMigrationLock(
          database,
          async () => {
            const currentAuthority = await readCharacterAuthority(
              database,
              run.authority.namespace
            );
            if (currentAuthority.authority === 'indexedDB') {
              await assertCommittedProtectedSource({
                run,
                receipts: options.receipts,
                storage: options.storage,
                appVersion: options.appVersion,
              });
              const coverage = await inspectCurrentCharacterSafetyCoverage({
                factory: options.factory,
                storage: options.storage,
                namespace: run.authority.namespace,
                expectedAuthority: currentAuthority,
              });
              const currentFileVerified = await verifyCurrentCharacterReceipt({
                run,
                receipts: options.receipts,
                factory: options.factory,
              });
              if (
                !coverage.broadFileCoversCurrentCharacters &&
                !currentFileVerified
              ) {
                throw new Error('Current character safety coverage is missing');
              }
              const evidence = await readCharacterActivationEvidence(
                database,
                run.authority.namespace,
                currentAuthority.generation
              );
              if (!evidence) {
                throw new Error(
                  'Immutable character activation evidence is missing'
                );
              }
              const observed = readCharacterCutoverSelection(
                options.storage,
                run.authority.namespace
              );
              const selection =
                observed?.activatedGeneration === undefined &&
                observed?.activatedEpoch === undefined
                  ? repairCharacterCutoverActivationFromEvidence(
                      options.storage,
                      run.authority.namespace,
                      evidence,
                      { runId: run.runId, accountId: run.accountId }
                    )
                  : rebindCharacterCutoverSelection(
                      options.storage,
                      run.authority.namespace,
                      {
                        evidence,
                        generation: currentAuthority.generation,
                        epoch: currentAuthority.epoch,
                        playerBackupRunId: run.runId,
                        playerBackupAccountId: run.accountId,
                        playerBackupAuthorizedAt: run.confirmedAt,
                      }
                    );
              return advancePlayerBackupRunToLocalReady(database, {
                accountId: run.accountId,
                expectedActiveRunId: run.runId,
                authority: {
                  kind: 'indexedDB',
                  namespace: currentAuthority.namespace,
                  family: currentAuthority.family,
                  generation: currentAuthority.generation,
                  epoch: currentAuthority.epoch,
                },
                selectionAuthorizedAt: selection.playerBackupAuthorizedAt!,
                verifiedAt: options.now(),
              });
            }

            const initial = await assertCommittedProtectedSource({
              run,
              receipts: options.receipts,
              storage: options.storage,
              appVersion: options.appVersion,
            });
            let selection = readCharacterCutoverSelection(
              options.storage,
              run.authority.namespace
            );
            if (!selection) {
              if (
                !deviceBackupEntryVectorsEqual(initial.before, initial.after)
              ) {
                throw new Error('The safety source changed before selection');
              }
              selectCharacterCutover(
                options.storage,
                run.authority.namespace,
                true,
                () => run.confirmedAt,
                {
                  manifestHash: run.broadSafetyReceipt.manifestHash,
                  runId: run.broadSafetyReceipt.runId,
                  createdAt: run.broadSafetyReceipt.createdAt,
                },
                {
                  runId: run.runId,
                  accountId: run.accountId,
                  authorizedAt: run.confirmedAt,
                }
              );
              selection = readCharacterCutoverSelection(
                options.storage,
                run.authority.namespace
              );
            }
            const verifyProtectedSource = async () => {
              const check = await assertCommittedProtectedSource({
                run,
                receipts: options.receipts,
                storage: options.storage,
                appVersion: options.appVersion,
              });
              const compared = compareProtectedSourceEntries({
                before: check.before,
                after: check.after.entries,
                selectionRaw: options.storage.getItem(
                  characterCutoverSelectionKey(run.authority.namespace)
                ),
                selection: {
                  namespace: run.authority.namespace,
                  mode: 'first-activation',
                  broadReceipt: run.broadSafetyReceipt,
                  playerBackupRunId: run.runId,
                  accountId: run.accountId,
                  authorizedAt: run.confirmedAt,
                },
              });
              return (
                compared.protectedSourceUnchanged && compared.selectionValid
              );
            };
            if (!selection || !(await verifyProtectedSource())) {
              throw new Error(
                'Character selection is not authorized by consent'
              );
            }
            const verifiedGate = {
              hasDownloadReceipt: (manifestHash: string) =>
                options.receipts.hasVerifiedDownloadReceipt(manifestHash),
            };
            const prepared = await bootstrapCharacterPersistence({
              factory: options.factory,
              storage: options.storage,
              namespace: run.authority.namespace,
              runId: run.runId,
              ownerId: options.ownerId,
              now: options.now,
              nowMs: options.nowMs,
              recoveryGate: verifiedGate,
              requiredRecoveryManifestHash: run.broadSafetyReceipt.manifestHash,
              locks: ALREADY_LOCKED_MIGRATION,
              storageManager: options.storageManager,
            });
            if (prepared.state !== 'CUTOVER_READY') {
              throw new Error('Character preparation did not reach readiness');
            }
            const authority = await activatePreparedCharacterCutover({
              factory: options.factory,
              storage: options.storage,
              namespace: run.authority.namespace,
              recoveryManifestHash: run.broadSafetyReceipt.manifestHash,
              recoveryRunId: run.broadSafetyReceipt.runId,
              recoveryCreatedAt: run.broadSafetyReceipt.createdAt,
              appVersion: options.appVersion,
              recoveryGate: verifiedGate,
              verifyProtectedSource,
              activationEvidence: {
                selectedAt: selection.selectedAt,
                recoveryManifestHash: selection.recoveryManifestHash!,
                recoveryRunId: selection.recoveryRunId!,
                recoveryCreatedAt: selection.recoveryCreatedAt!,
                playerBackupRunId: run.runId,
                playerBackupAccountId: run.accountId,
                playerBackupAuthorizedAt: run.confirmedAt,
              },
              confirmed: true,
              now: options.now,
            });
            markCharacterCutoverActivated(
              options.storage,
              run.authority.namespace,
              authority.epoch,
              authority.generation
            );
            const readBack = readCharacterCutoverSelection(
              options.storage,
              run.authority.namespace
            );
            if (
              readBack?.activatedGeneration !== authority.generation ||
              readBack.activatedEpoch !== authority.epoch ||
              readBack.playerBackupRunId !== run.runId ||
              readBack.playerBackupAccountId !== run.accountId
            ) {
              throw new Error('Character activation marker was not verified');
            }
            return advancePlayerBackupRunToLocalReady(database, {
              accountId: run.accountId,
              expectedActiveRunId: run.runId,
              authority: {
                kind: 'indexedDB',
                namespace: authority.namespace,
                family: authority.family,
                generation: authority.generation,
                epoch: authority.epoch,
              },
              selectionAuthorizedAt: readBack.playerBackupAuthorizedAt!,
              verifiedAt: options.now(),
            });
          },
          {
            ownerId: options.ownerId,
            now: options.nowMs,
            locks: options.locks ?? undefined,
          }
        );
      } finally {
        database.close();
      }
    }
  );
}
