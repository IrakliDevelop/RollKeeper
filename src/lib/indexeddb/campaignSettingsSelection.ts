import { isCampaignSettingsClientVisible } from '@/lib/durableDm/slice11aFlags';

import type { StorageNamespace } from './shadowJournal';

interface SelectionStorage {
  getItem(key: string): string | null;
}

interface WritableSelectionStorage extends SelectionStorage {
  setItem(key: string, value: string): void;
}

export interface CampaignSettingsSelection {
  version: 1;
  namespace: StorageNamespace;
  campaignId: string;
  family: 'campaign_settings';
  selectedAt: string;
  recovery: { runId: string; manifestHash: string; createdAt: string };
}

export function campaignSettingsSelectionKey(
  namespace: StorageNamespace,
  campaignId: string
) {
  return `rollkeeper:campaign-settings-selection:${namespace}:${campaignId}`;
}

export function hasCampaignSettingsSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  const raw = storage.getItem(
    campaignSettingsSelectionKey(namespace, campaignId)
  );
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignSettingsSelection>;
    return (
      parsed.version === 1 &&
      parsed.namespace === namespace &&
      parsed.campaignId === campaignId &&
      parsed.family === 'campaign_settings' &&
      typeof parsed.selectedAt === 'string' &&
      typeof parsed.recovery?.runId === 'string' &&
      /^[a-f0-9]{64}$/u.test(parsed.recovery.manifestHash ?? '')
    );
  } catch {
    return false;
  }
}

export function readCampaignSettingsSelection(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
): CampaignSettingsSelection | null {
  if (!hasCampaignSettingsSelection(storage, namespace, campaignId))
    return null;
  return JSON.parse(
    storage.getItem(campaignSettingsSelectionKey(namespace, campaignId))!
  ) as CampaignSettingsSelection;
}

export function selectCampaignSettings(
  storage: WritableSelectionStorage,
  options: {
    namespace: StorageNamespace;
    campaignId: string;
    confirmed: boolean;
    recovery: CampaignSettingsSelection['recovery'];
    now: () => string;
  }
) {
  if (!options.confirmed)
    throw new Error('Campaign settings selection requires confirmation');
  if (!/^user:/u.test(options.namespace))
    throw new Error('Owner account namespace is required');
  if (!/^[a-f0-9]{64}$/u.test(options.recovery.manifestHash)) {
    throw new Error('Matching recovery manifest receipt is required');
  }
  storage.setItem(
    campaignSettingsSelectionKey(options.namespace, options.campaignId),
    JSON.stringify({
      version: 1,
      namespace: options.namespace,
      campaignId: options.campaignId,
      family: 'campaign_settings',
      selectedAt: options.now(),
      recovery: options.recovery,
    } satisfies CampaignSettingsSelection)
  );
}

export function isCampaignSettingsParticipant(
  storage: SelectionStorage,
  namespace: StorageNamespace,
  campaignId: string
) {
  return (
    isCampaignSettingsClientVisible() &&
    hasCampaignSettingsSelection(storage, namespace, campaignId)
  );
}
