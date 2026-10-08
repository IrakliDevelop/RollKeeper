'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  adoptMapLocally,
  createPersistedLegacyTableAdoptionSource,
} from '@/lib/table/adoption';
import type { TableRepository } from '@/lib/table/repository';
import { useBattleMapStore } from '@/store/battleMapStore';
import type { BattleMap } from '@/types/battlemap';

const NO_MAPS: Record<string, BattleMap> = {};

/**
 * W5 browser state: panel open/closed (no subscriptions), create dialog,
 * read-only listing of unadopted battle maps and LOCAL-only adoption
 * (R3-F1) followed by a private selection of the new scene.
 */
export function useWorkspaceSceneBrowser(options: {
  campaignCode: string;
  repository: TableRepository | null;
  initiallyOpen: boolean;
  onSelect: (sceneId: string) => void;
}) {
  const { campaignCode, repository, onSelect } = options;
  const [open, setOpen] = useState(options.initiallyOpen);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    tone: 'alert' | 'status';
    text: string;
  } | null>(null);
  const maps = useBattleMapStore(
    state => state.battleMaps[campaignCode] ?? NO_MAPS
  );
  const current = repository?.getCurrent();
  const mappings =
    current?.status === 'ready'
      ? (current.snapshot.campaign?.sourceMappings ?? [])
      : [];
  const adopted = new Set(
    mappings
      .filter(mapping => mapping.sourceCampaignId === campaignCode)
      .map(mapping => mapping.sourceMapId)
  );
  const adoptable = Object.values(maps)
    .filter(map => !adopted.has(map.id))
    .map(map => ({ id: map.id, name: map.name }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const source = useMemo(
    () =>
      createPersistedLegacyTableAdoptionSource({
        storage: {
          getItem: key =>
            typeof window === 'undefined'
              ? null
              : window.localStorage.getItem(key),
        },
      }),
    []
  );

  const adopt = useCallback(
    async (mapId: string) => {
      if (!repository) return;
      setBusy(true);
      setStatus({ tone: 'status', text: 'Adding the battle map…' });
      try {
        const result = await adoptMapLocally({
          repository,
          source,
          campaignCode,
          mapId,
        });
        if (result.status === 'committed') {
          setStatus({
            tone: 'status',
            text: `${result.name} added to this workspace. The original map was not changed.`,
          });
          onSelect(result.sceneId);
          return;
        }
        setStatus({
          tone: 'alert',
          text:
            result.status === 'source-changed'
              ? 'The battle map changed while it was being added. Try again.'
              : `The battle map was not added (${result.status}).`,
        });
      } catch (error) {
        setStatus({
          tone: 'alert',
          text:
            error instanceof Error
              ? error.message
              : 'The battle map could not be added.',
        });
      } finally {
        setBusy(false);
      }
    },
    [campaignCode, onSelect, repository, source]
  );

  return {
    open,
    setOpen,
    toggle: useCallback(() => setOpen(value => !value), []),
    creating,
    setCreating,
    busy,
    status,
    adoptable,
    adopt,
  };
}
