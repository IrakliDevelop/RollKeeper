import { isCombatLogArchiveClientVisible } from '@/lib/durableDm/slice11fFlags';

import type { StorageNamespace } from './shadowJournal';

interface SelectionStorage {
  getItem(key: string): string | null;
}

interface WritableSelectionStorage extends SelectionStorage {
  setItem(key: string, value: string): void;
}

export interface CombatLogArchiveSelection {
  version: 1;
  namespace: StorageNamespace;
  campaignId: string;
  family: 'combat_log_archive';
  selectedAt: string;
  recovery: { runId: string; manifestHash: string; createdAt: string };
}

export function combatLogArchiveSelectionKey(
  namespace: StorageNamespace,
  campaignId: string
) {
  return `rollkeeper:combat-log-archive-selection:${namespace}:${campaignId}`;
}

export function hasCombatLogArchiveSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  const raw = storage.getItem(
    combatLogArchiveSelectionKey(namespace, campaignId)
  );
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<CombatLogArchiveSelection>;
    return (
      parsed.version === 1 &&
      parsed.namespace === namespace &&
      parsed.campaignId === campaignId &&
      parsed.family === 'combat_log_archive' &&
      typeof parsed.selectedAt === 'string' &&
      typeof parsed.recovery?.runId === 'string' &&
      /^[a-f0-9]{64}$/u.test(parsed.recovery.manifestHash ?? '')
    );
  } catch {
    return false;
  }
}

export function readCombatLogArchiveSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
): CombatLogArchiveSelection | null {
  if (!hasCombatLogArchiveSelection(storage, namespace, campaignId))
    return null;
  return JSON.parse(
    storage.getItem(combatLogArchiveSelectionKey(namespace, campaignId))!
  ) as CombatLogArchiveSelection;
}

export function selectCombatLogArchiveFamily(
  storage: WritableSelectionStorage,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    confirmed: boolean;
    recovery: CombatLogArchiveSelection['recovery'];
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('Combat log archive selection requires confirmation');
  if (!/^user:/u.test(options.namespace))
    throw new Error('Owner account namespace is required');
  if (!/^[a-f0-9]{64}$/u.test(options.recovery.manifestHash)) {
    throw new Error('Matching recovery manifest receipt is required');
  }
  storage.setItem(
    combatLogArchiveSelectionKey(options.namespace, options.campaignId),
    JSON.stringify({
      version: 1,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'combat_log_archive',
      selectedAt: options.now(),
      recovery: options.recovery,
    } satisfies CombatLogArchiveSelection)
  );
}

export function isCombatLogArchiveParticipant(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    isCombatLogArchiveClientVisible() &&
    hasCombatLogArchiveSelection(storage, namespace, campaignId)
  );
}
