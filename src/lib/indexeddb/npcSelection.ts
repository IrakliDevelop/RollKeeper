import { isNpcClientVisible } from '@/lib/durableDm/slice11dFlags';

import type { StorageNamespace } from './shadowJournal';

interface SelectionStorage {
  getItem(key: string): string | null;
}

interface WritableSelectionStorage extends SelectionStorage {
  setItem(key: string, value: string): void;
}

export interface NpcSelection {
  version: 1;
  namespace: StorageNamespace;
  campaignId: string;
  family: 'npc';
  selectedAt: string;
  recovery: { runId: string; manifestHash: string; createdAt: string };
}

export function npcSelectionKey(
  namespace: StorageNamespace,
  campaignId: string
) {
  return `rollkeeper:npc-selection:${namespace}:${campaignId}`;
}

export function hasNpcSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  const raw = storage.getItem(npcSelectionKey(namespace, campaignId));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<NpcSelection>;
    return (
      parsed.version === 1 &&
      parsed.namespace === namespace &&
      parsed.campaignId === campaignId &&
      parsed.family === 'npc' &&
      typeof parsed.selectedAt === 'string' &&
      typeof parsed.recovery?.runId === 'string' &&
      /^[a-f0-9]{64}$/u.test(parsed.recovery.manifestHash ?? '')
    );
  } catch {
    return false;
  }
}

export function readNpcSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
): NpcSelection | null {
  if (!hasNpcSelection(storage, namespace, campaignId)) return null;
  return JSON.parse(
    storage.getItem(npcSelectionKey(namespace, campaignId))!
  ) as NpcSelection;
}

export function selectNpcFamily(
  storage: WritableSelectionStorage,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    confirmed: boolean;
    recovery: NpcSelection['recovery'];
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('NPC selection requires confirmation');
  if (!/^user:/u.test(options.namespace))
    throw new Error('Owner account namespace is required');
  if (!/^[a-f0-9]{64}$/u.test(options.recovery.manifestHash)) {
    throw new Error('Matching recovery manifest receipt is required');
  }
  storage.setItem(
    npcSelectionKey(options.namespace, options.campaignId),
    JSON.stringify({
      version: 1,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'npc',
      selectedAt: options.now(),
      recovery: options.recovery,
    } satisfies NpcSelection)
  );
}

export function isNpcParticipant(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    isNpcClientVisible() && hasNpcSelection(storage, namespace, campaignId)
  );
}
