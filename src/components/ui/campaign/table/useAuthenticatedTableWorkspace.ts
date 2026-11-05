'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { TableRepository } from '@/lib/table/repository';
import { openTableWorkspace } from '@/lib/table/sceneAdapter';

export interface AuthenticatedTableWorkspaceState {
  repository: TableRepository | null;
  revision: number;
  loading: boolean;
  error: string | null;
}

/**
 * Owns the repository for exactly the currently selected auth identity. Auth
 * callbacks synchronously clear and dispose the previous namespace before any
 * asynchronous open for the replacement identity begins.
 */
export function useAuthenticatedTableWorkspace(options: {
  sourceCampaignCode: string;
  localWorkspaceId?: string | null;
}): AuthenticatedTableWorkspaceState {
  const [repository, setRepository] = useState<TableRepository | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let generation = 0;
    let authEventObserved = false;
    let active: TableRepository | null = null;
    let unsubscribeRepository: (() => void) | null = null;

    const reset = () => {
      unsubscribeRepository?.();
      unsubscribeRepository = null;
      active?.dispose();
      active = null;
      setRepository(null);
      setRevision(value => value + 1);
    };
    const open = async (accountId: string | null) => {
      const ticket = ++generation;
      reset();
      setLoading(true);
      setError(null);
      try {
        const opened = await openTableWorkspace({
          account: accountId
            ? { kind: 'authenticated', accountId }
            : { kind: 'guest' },
          sourceCampaignCode: options.sourceCampaignCode,
          localWorkspaceId: options.localWorkspaceId,
        });
        if (stopped || ticket !== generation) {
          opened.repository.dispose();
          return;
        }
        active = opened.repository;
        unsubscribeRepository = active.subscribe(() =>
          setRevision(value => value + 1)
        );
        setRepository(active);
        setRevision(value => value + 1);
      } catch (cause) {
        if (stopped || ticket !== generation) return;
        setError(
          cause instanceof Error
            ? cause.message
            : 'Table storage is unavailable on this device.'
        );
      } finally {
        if (!stopped && ticket === generation) setLoading(false);
      }
    };

    const client = createSupabaseBrowserClient();
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      authEventObserved = true;
      void open(session?.user?.id ?? null);
    }).data.subscription;
    if (client) {
      void client.auth
        .getUser()
        .then(({ data }) => {
          if (!authEventObserved) return open(data.user?.id ?? null);
        })
        .catch(() => {
          if (!authEventObserved) return open(null);
        });
    } else {
      void open(null);
    }

    return () => {
      stopped = true;
      generation += 1;
      subscription?.unsubscribe();
      reset();
    };
  }, [options.localWorkspaceId, options.sourceCampaignCode]);

  return { repository, revision, loading, error };
}
