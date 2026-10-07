'use client';

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { TableWorkspaceSelection } from '@/lib/table/repository';
import {
  findSceneRunsForCampaign,
  findSceneRunsForEncounter,
  type TableSceneRunLink,
} from '@/lib/table/combatLibrary';

const NONE: TableSceneRunLink[] = [];

async function currentAccount(): Promise<TableWorkspaceSelection['account']> {
  try {
    const client = createSupabaseBrowserClient();
    const id = client
      ? ((await client.auth.getUser()).data.user?.id ?? null)
      : null;
    return id ? { kind: 'authenticated', accountId: id } : { kind: 'guest' };
  } catch {
    return { kind: 'guest' };
  }
}

interface SharedLinks {
  campaignCode: string;
  byEncounter: ReadonlyMap<string, TableSceneRunLink[]>;
}

const SceneRunLinksContext = createContext<SharedLinks | null>(null);

/**
 * One shared scene-run lookup for a whole encounter list (F7): a single
 * account lookup and a single read-only Table read, disposed on unmount.
 * It never creates Table storage.
 */
export function SceneRunLinksProvider(props: {
  campaignCode: string;
  children: ReactNode;
}) {
  const [byEncounter, setByEncounter] = useState<
    ReadonlyMap<string, TableSceneRunLink[]>
  >(() => new Map());
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await findSceneRunsForCampaign({
        account: await currentAccount(),
        campaignCode: props.campaignCode,
      });
      if (!cancelled) setByEncounter(found);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [props.campaignCode]);
  return createElement(
    SceneRunLinksContext.Provider,
    { value: { campaignCode: props.campaignCode, byEncounter } },
    props.children
  );
}

/**
 * Scene runs adopted from a library encounter in the current DM workspace.
 * Inside a `SceneRunLinksProvider` it reads the shared map; standalone (the
 * encounter page header) it performs its own read-only lookup.
 */
export function useSceneRunLinks(
  campaignCode: string,
  encounterId: string
): TableSceneRunLink[] {
  const shared = useContext(SceneRunLinksContext);
  const useShared = shared !== null && shared.campaignCode === campaignCode;
  const [own, setOwn] = useState<TableSceneRunLink[]>(NONE);
  useEffect(() => {
    if (useShared) return;
    let cancelled = false;
    void (async () => {
      const found = await findSceneRunsForEncounter({
        account: await currentAccount(),
        campaignCode,
        encounterId,
      });
      if (!cancelled) setOwn(found.length > 0 ? found : NONE);
    })().catch(() => {
      if (!cancelled) setOwn(NONE);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignCode, encounterId, useShared]);
  if (useShared) return shared.byEncounter.get(encounterId) ?? NONE;
  return own;
}
