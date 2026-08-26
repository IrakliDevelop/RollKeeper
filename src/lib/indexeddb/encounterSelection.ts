import { isEncounterClientVisible } from '@/lib/durableDm/slice11eFlags';

import type { StorageNamespace } from './shadowJournal';

interface SelectionStorage {
  getItem(key: string): string | null;
}

interface WritableSelectionStorage extends SelectionStorage {
  setItem(key: string, value: string): void;
}

export interface EncounterSelection {
  version: 1;
  namespace: StorageNamespace;
  campaignId: string;
  family: 'encounter_definition';
  selectedAt: string;
  recovery: { runId: string; manifestHash: string; createdAt: string };
}

export function encounterSelectionKey(
  namespace: StorageNamespace,
  campaignId: string
) {
  return `rollkeeper:encounter-selection:${namespace}:${campaignId}`;
}

export function hasEncounterSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  const raw = storage.getItem(encounterSelectionKey(namespace, campaignId));
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<EncounterSelection>;
    return (
      parsed.version === 1 &&
      parsed.namespace === namespace &&
      parsed.campaignId === campaignId &&
      parsed.family === 'encounter_definition' &&
      typeof parsed.selectedAt === 'string' &&
      typeof parsed.recovery?.runId === 'string' &&
      /^[a-f0-9]{64}$/u.test(parsed.recovery.manifestHash ?? '')
    );
  } catch {
    return false;
  }
}

export function readEncounterSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
): EncounterSelection | null {
  if (!hasEncounterSelection(storage, namespace, campaignId)) return null;
  return JSON.parse(
    storage.getItem(encounterSelectionKey(namespace, campaignId))!
  ) as EncounterSelection;
}

export function selectEncounterFamily(
  storage: WritableSelectionStorage,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    confirmed: boolean;
    recovery: EncounterSelection['recovery'];
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('Encounter selection requires confirmation');
  if (!/^user:/u.test(options.namespace))
    throw new Error('Owner account namespace is required');
  if (!/^[a-f0-9]{64}$/u.test(options.recovery.manifestHash)) {
    throw new Error('Matching recovery manifest receipt is required');
  }
  storage.setItem(
    encounterSelectionKey(options.namespace, options.campaignId),
    JSON.stringify({
      version: 1,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'encounter_definition',
      selectedAt: options.now(),
      recovery: options.recovery,
    } satisfies EncounterSelection)
  );
}

export function isEncounterParticipant(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    isEncounterClientVisible() &&
    hasEncounterSelection(storage, namespace, campaignId)
  );
}
