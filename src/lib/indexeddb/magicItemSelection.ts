import { isMagicItemClientVisible } from '@/lib/durableDm/slice11cFlags';

import type { StorageNamespace } from './shadowJournal';

interface SelectionStorage {
  getItem(key: string): string | null;
}

interface WritableSelectionStorage extends SelectionStorage {
  setItem(key: string, value: string): void;
}

export interface MagicItemSelection {
  version: 1;
  namespace: StorageNamespace;
  campaignId: string;
  family: 'magic_item';
  selectedAt: string;
  recovery: { runId: string; manifestHash: string; createdAt: string };
}

export function magicItemSelectionKey(
  namespace: StorageNamespace,
  campaignId: string
) {
  return `rollkeeper:magic-item-selection:${namespace}:${campaignId}`;
}

export function hasMagicItemSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  const raw = storage.getItem(magicItemSelectionKey(namespace, campaignId));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<MagicItemSelection>;
    return (
      parsed.version === 1 &&
      parsed.namespace === namespace &&
      parsed.campaignId === campaignId &&
      parsed.family === 'magic_item' &&
      typeof parsed.selectedAt === 'string' &&
      typeof parsed.recovery?.runId === 'string' &&
      /^[a-f0-9]{64}$/u.test(parsed.recovery.manifestHash ?? '')
    );
  } catch {
    return false;
  }
}

export function readMagicItemSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
): MagicItemSelection | null {
  if (!hasMagicItemSelection(storage, namespace, campaignId)) return null;
  return JSON.parse(
    storage.getItem(magicItemSelectionKey(namespace, campaignId))!
  ) as MagicItemSelection;
}

export function selectMagicItemLibrary(
  storage: WritableSelectionStorage,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    confirmed: boolean;
    recovery: MagicItemSelection['recovery'];
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('Magic item library selection requires confirmation');
  if (!/^user:/u.test(options.namespace))
    throw new Error('Owner account namespace is required');
  if (!/^[a-f0-9]{64}$/u.test(options.recovery.manifestHash)) {
    throw new Error('Matching recovery manifest receipt is required');
  }
  storage.setItem(
    magicItemSelectionKey(options.namespace, options.campaignId),
    JSON.stringify({
      version: 1,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'magic_item',
      selectedAt: options.now(),
      recovery: options.recovery,
    } satisfies MagicItemSelection)
  );
}

export function isMagicItemParticipant(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    isMagicItemClientVisible() &&
    hasMagicItemSelection(storage, namespace, campaignId)
  );
}
