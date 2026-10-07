'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  findSceneRunsForEncounter,
  type TableSceneRunLink,
} from '@/lib/table/combatLibrary';

const NONE: TableSceneRunLink[] = [];

/**
 * Scene runs adopted from a library encounter in the current DM workspace
 * (read-only, never creates Table storage). Disposed on unmount.
 */
export function useSceneRunLinks(
  campaignCode: string,
  encounterId: string
): TableSceneRunLink[] {
  const [links, setLinks] = useState<TableSceneRunLink[]>(NONE);
  useEffect(() => {
    let cancelled = false;
    const lookup = async () => {
      let accountId: string | null = null;
      try {
        const client = createSupabaseBrowserClient();
        accountId = client
          ? ((await client.auth.getUser()).data.user?.id ?? null)
          : null;
      } catch {
        accountId = null;
      }
      const found = await findSceneRunsForEncounter({
        account: accountId
          ? { kind: 'authenticated', accountId }
          : { kind: 'guest' },
        campaignCode,
        encounterId,
      });
      if (!cancelled) setLinks(found.length > 0 ? found : NONE);
    };
    void lookup().catch(() => {
      if (!cancelled) setLinks(NONE);
    });
    return () => {
      cancelled = true;
    };
  }, [campaignCode, encounterId]);
  return links;
}
