import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';
import type { CharacterActivationEvidence } from './characterAuthority';

import { CHARACTER_FAMILY } from './characterFamily';

export const CHARACTER_CUTOVER_SELECTION_PREFIX =
  'rollkeeper:indexeddb-selection:';

interface SelectionStorage {
  getItem(key: string): string | null;
}

interface WritableSelectionStorage extends SelectionStorage {
  setItem(key: string, value: string): void;
}

export interface CharacterCutoverSelection {
  version: 1;
  namespace: StorageNamespace;
  family: typeof CHARACTER_FAMILY;
  selectedAt: string;
  recoveryManifestHash?: string;
  recoveryRunId?: string;
  recoveryCreatedAt?: string;
  activatedEpoch?: number;
  activatedGeneration?: string;
  playerBackupRunId?: string;
  playerBackupAccountId?: string;
  playerBackupAuthorizedAt?: string;
}

export function characterCutoverSelectionKey(
  namespace: StorageNamespace
): string {
  return `${CHARACTER_CUTOVER_SELECTION_PREFIX}${namespace}:${CHARACTER_FAMILY}`;
}

export function isCharacterCutoverDeploymentEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED === 'true';
}

export function hasCharacterCutoverSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace
): boolean {
  const raw = storage.getItem(characterCutoverSelectionKey(namespace));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<CharacterCutoverSelection>;
    return (
      parsed.version === 1 &&
      parsed.namespace === namespace &&
      parsed.family === CHARACTER_FAMILY &&
      typeof parsed.selectedAt === 'string'
    );
  } catch {
    return false;
  }
}

export function selectCharacterCutover(
  storage: WritableSelectionStorage,
  namespace: StorageNamespace,
  confirmed: boolean,
  now: () => string = () => new Date().toISOString(),
  recovery?: {
    manifestHash: string;
    runId: string;
    createdAt: string;
  },
  playerBackup?: {
    runId: string;
    accountId: string;
    authorizedAt: string;
  }
): void {
  if (!confirmed) {
    throw new Error('Character migration requires explicit confirmation');
  }
  const selection: CharacterCutoverSelection = {
    version: 1,
    namespace,
    family: CHARACTER_FAMILY,
    selectedAt: now(),
    ...(recovery
      ? {
          recoveryManifestHash: recovery.manifestHash,
          recoveryRunId: recovery.runId,
          recoveryCreatedAt: recovery.createdAt,
        }
      : {}),
    ...(playerBackup
      ? {
          playerBackupRunId: playerBackup.runId,
          playerBackupAccountId: playerBackup.accountId,
          playerBackupAuthorizedAt: playerBackup.authorizedAt,
        }
      : {}),
  };
  storage.setItem(
    characterCutoverSelectionKey(namespace),
    JSON.stringify(selection)
  );
}

export function readCharacterCutoverSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace
): CharacterCutoverSelection | null {
  if (!hasCharacterCutoverSelection(storage, namespace)) return null;
  return JSON.parse(
    storage.getItem(characterCutoverSelectionKey(namespace))!
  ) as CharacterCutoverSelection;
}

export function markCharacterCutoverActivated(
  storage: WritableSelectionStorage,
  namespace: StorageNamespace,
  epoch: number,
  generation?: string
): void {
  const selection = readCharacterCutoverSelection(storage, namespace);
  if (!selection) throw new Error('Character cutover selection is missing');
  if (
    (selection.activatedEpoch !== undefined &&
      selection.activatedEpoch !== epoch) ||
    (selection.activatedGeneration !== undefined &&
      selection.activatedGeneration !== generation)
  ) {
    throw new Error('Character cutover activation fields already differ');
  }
  storage.setItem(
    characterCutoverSelectionKey(namespace),
    JSON.stringify({
      ...selection,
      activatedEpoch: epoch,
      ...(generation ? { activatedGeneration: generation } : {}),
    })
  );
}

function selectionMatchesActivationEvidence(
  selection: CharacterCutoverSelection,
  evidence: CharacterActivationEvidence
): boolean {
  return (
    selection.version === 1 &&
    selection.namespace === evidence.namespace &&
    selection.family === evidence.family &&
    selection.selectedAt === evidence.selectedAt &&
    selection.recoveryManifestHash === evidence.recoveryManifestHash &&
    selection.recoveryRunId === evidence.recoveryRunId &&
    selection.recoveryCreatedAt === evidence.recoveryCreatedAt
  );
}

export function assertCharacterCutoverSelectionActivation(options: {
  selection: CharacterCutoverSelection | null;
  evidence: CharacterActivationEvidence | null;
  namespace: StorageNamespace;
  generation: string;
  epoch: number;
}): CharacterCutoverSelection {
  const { selection, evidence } = options;
  if (
    !selection ||
    !evidence ||
    selection.namespace !== options.namespace ||
    !selectionMatchesActivationEvidence(selection, evidence) ||
    selection.activatedGeneration !== options.generation ||
    selection.activatedEpoch !== options.epoch ||
    evidence.activatedGeneration !== options.generation ||
    evidence.activatedEpoch !== options.epoch
  ) {
    throw new Error('Character selection activation evidence is invalid');
  }
  return selection;
}

export function repairCharacterCutoverActivationFromEvidence(
  storage: WritableSelectionStorage,
  namespace: StorageNamespace,
  evidence: CharacterActivationEvidence,
  expectedAuthorization: { runId: string; accountId: string }
): CharacterCutoverSelection {
  const selection = readCharacterCutoverSelection(storage, namespace);
  if (
    !selection ||
    selection.activatedEpoch !== undefined ||
    selection.activatedGeneration !== undefined ||
    !selectionMatchesActivationEvidence(selection, evidence) ||
    selection.playerBackupRunId !== expectedAuthorization.runId ||
    selection.playerBackupAccountId !== expectedAuthorization.accountId ||
    selection.playerBackupRunId !== evidence.playerBackupRunId ||
    selection.playerBackupAccountId !== evidence.playerBackupAccountId ||
    selection.playerBackupAuthorizedAt !== evidence.playerBackupAuthorizedAt
  ) {
    throw new Error(
      'Character activation marker does not match immutable evidence'
    );
  }
  const repaired: CharacterCutoverSelection = {
    ...selection,
    activatedEpoch: evidence.activatedEpoch,
    activatedGeneration: evidence.activatedGeneration,
  };
  storage.setItem(
    characterCutoverSelectionKey(namespace),
    JSON.stringify(repaired)
  );
  return repaired;
}

export function rebindCharacterCutoverSelection(
  storage: WritableSelectionStorage,
  namespace: StorageNamespace,
  options: {
    evidence: CharacterActivationEvidence;
    generation: string;
    epoch: number;
    playerBackupRunId: string;
    playerBackupAccountId: string;
    playerBackupAuthorizedAt: string;
  }
): CharacterCutoverSelection {
  const selection = readCharacterCutoverSelection(storage, namespace);
  const verified = assertCharacterCutoverSelectionActivation({
    selection,
    evidence: options.evidence,
    namespace,
    generation: options.generation,
    epoch: options.epoch,
  });
  const rebound: CharacterCutoverSelection = {
    ...verified,
    playerBackupRunId: options.playerBackupRunId,
    playerBackupAccountId: options.playerBackupAccountId,
    playerBackupAuthorizedAt: options.playerBackupAuthorizedAt,
  };
  storage.setItem(
    characterCutoverSelectionKey(namespace),
    JSON.stringify(rebound)
  );
  return rebound;
}

export function isSelectedCharacterCutoverProfile(
  storage: SelectionStorage | undefined,
  namespace: StorageNamespace = 'guest'
): boolean {
  return (
    isCharacterCutoverDeploymentEnabled() &&
    storage !== undefined &&
    hasCharacterCutoverSelection(storage, namespace)
  );
}

export function isBrowserCharacterCutoverParticipant(
  namespace: StorageNamespace = 'guest'
): boolean {
  return isSelectedCharacterCutoverProfile(
    typeof localStorage === 'undefined' ? undefined : localStorage,
    namespace
  );
}
