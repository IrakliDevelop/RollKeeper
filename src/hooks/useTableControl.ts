import { useCallback, useEffect, useRef, useState } from 'react';
import type { TableCommand } from '@/lib/tableServer/validation';
import type { TableDescriptor, TableResult } from '@/lib/tableServer/control';

type TableStatus =
  | 'checking'
  | 'legacy'
  | 'waiting'
  | 'controlling'
  | 'broadcasting'
  | 'not-broadcasting'
  | 'error';

async function fetchBoundedJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ response: Response; data: T }> {
  const abort = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    fetch(url, { ...init, signal: abort.signal }).then(async response => ({
      response,
      data: (await response.json()) as T,
    })),
    new Promise<{ response: Response; data: T }>((_, reject) => {
      deadline = setTimeout(() => {
        abort.abort();
        reject(new Error('Control request timed out'));
      }, 5000);
    }),
  ]).finally(() => {
    if (deadline) clearTimeout(deadline);
  });
}

export function useTableControl(campaignCode: string, dmId: string) {
  const [status, setStatus] = useState<TableStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<TableDescriptor | null>(null);
  const currentRef = useRef<TableDescriptor | null>(null);
  const sessionId = useRef<string>(crypto.randomUUID());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingCount = useRef(0);
  const contextGeneration = useRef(0);
  const authorityGeneration = useRef(0);

  const updateCurrent = useCallback((value: TableDescriptor | null) => {
    currentRef.current = value;
    setCurrent(value);
  }, []);

  const refresh = useCallback(async () => {
    const generation = contextGeneration.current;
    const { response, data: payload } = await fetchBoundedJson<{
      current: TableDescriptor | null;
    }>(
      `/api/campaign/${encodeURIComponent(campaignCode)}/table/control?dmId=${encodeURIComponent(dmId)}`
    );
    if (!response.ok)
      throw new Error(`Control refresh failed (${response.status})`);
    if (generation !== contextGeneration.current)
      throw new Error('Control context changed');
    updateCurrent(payload.current);
    return payload.current;
  }, [campaignCode, dmId, updateCurrent]);

  useEffect(() => {
    contextGeneration.current += 1;
    authorityGeneration.current += 1;
    sessionId.current = crypto.randomUUID();
    currentRef.current = null;
    queue.current = Promise.resolve();
    setCurrent(null);
    setStatus('checking');
    setError(null);
    const generation = contextGeneration.current;
    let cancelled = false;
    const check = async () => {
      try {
        const { response, data } = await fetchBoundedJson<{
          required: boolean;
        }>(
          `/api/campaign/${encodeURIComponent(campaignCode)}/table/capability`
        );
        if (!response.ok)
          throw new Error(`Capability check failed (${response.status})`);
        if (cancelled || generation !== contextGeneration.current) return;
        if (!data.required) {
          setStatus('legacy');
          return;
        }
        const control = await refresh();
        if (!cancelled && generation === contextGeneration.current)
          setStatus(control ? 'not-broadcasting' : 'waiting');
      } catch (failure) {
        if (!cancelled && generation === contextGeneration.current) {
          setError(
            failure instanceof Error ? failure.message : 'Control unavailable'
          );
          setStatus('error');
        }
      }
    };
    void check();
    return () => {
      cancelled = true;
      contextGeneration.current += 1;
      authorityGeneration.current += 1;
    };
  }, [campaignCode, dmId, refresh]);

  const send = useCallback(
    async (makeCommand: (control: TableDescriptor | null) => TableCommand) => {
      if (pendingCount.current >= 8) {
        authorityGeneration.current += 1;
        const message = 'Too many pending control requests; not broadcasting';
        setStatus('error');
        setError(message);
        throw new Error(message);
      }
      pendingCount.current += 1;
      const generation = contextGeneration.current;
      const authority = authorityGeneration.current;
      const task = queue.current
        .then(async () => {
          if (generation !== contextGeneration.current)
            throw new Error('Control context changed');
          if (authority !== authorityGeneration.current)
            throw new Error('Control response superseded');
          if (!navigator.onLine)
            throw new Error('Disconnected; remote initiative may be stale');
          const command = makeCommand(currentRef.current);
          const { response, data: result } =
            await fetchBoundedJson<TableResult>(
              `/api/campaign/${encodeURIComponent(campaignCode)}/table/control`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-rollkeeper-csrf': '1',
                },
                body: JSON.stringify({ dmId, command }),
              }
            );
          if (
            generation !== contextGeneration.current ||
            authority !== authorityGeneration.current ||
            !navigator.onLine
          ) {
            throw new Error('Control response superseded');
          }
          if (result.current) updateCurrent(result.current);
          if (!response.ok || result.status !== 'committed') {
            throw new Error(
              result.reason ?? `Control failed (${response.status})`
            );
          }
          if (result.historical && command.type === 'publishInitiative') {
            throw new Error('Historical publication is not current');
          }
          setError(null);
          if (command.type === 'acquire' || command.type === 'takeover') {
            setStatus('controlling');
          } else if (command.type === 'renew') {
            setStatus(previous =>
              previous === 'broadcasting' ? 'broadcasting' : 'controlling'
            );
          } else if (command.type === 'publishInitiative') {
            setStatus('broadcasting');
          } else if (command.type === 'endInitiative') {
            setStatus('controlling');
          }
        })
        .catch((failure: unknown) => {
          if (
            generation === contextGeneration.current &&
            navigator.onLine &&
            !(
              failure instanceof Error &&
              failure.message === 'Control response superseded'
            )
          ) {
            authorityGeneration.current += 1;
            setStatus('error');
            setError(
              failure instanceof Error ? failure.message : 'Control unavailable'
            );
          }
          throw failure;
        })
        .finally(() => {
          pendingCount.current -= 1;
        });
      queue.current = task.catch(() => {});
      return task;
    },
    [campaignCode, dmId, updateCurrent]
  );

  const initialize = useCallback(async () => {
    await send(() => ({
      type: 'initialize',
      operationId: crypto.randomUUID(),
    }));
    setStatus('not-broadcasting');
  }, [send]);

  const leaseCommand = useCallback(
    (type: 'acquire' | 'renew' | 'takeover') =>
      send(control => {
        if (!control) throw new Error('Initialize control first');
        return {
          type,
          operationId: crypto.randomUUID(),
          expectedEpoch: control.epoch,
          expectedRevision: control.revision,
          expectedFence: control.writerFence,
          holderSessionId: sessionId.current,
        };
      }),
    [send]
  );

  const publish = useCallback(
    (
      type: 'publishInitiative' | 'endInitiative' | 'publishInitiativeRequest',
      payload?: Record<string, unknown>
    ) =>
      send(control => {
        if (
          !control ||
          control.holderSessionId !== sessionId.current ||
          control.leaseUntil <= Date.now()
        ) {
          throw new Error('Table lease is not held by this session');
        }
        return {
          type,
          operationId: crypto.randomUUID(),
          expectedEpoch: control.epoch,
          expectedRevision: control.revision,
          expectedFence: control.writerFence,
          holderSessionId: sessionId.current,
          ...payload,
        } as TableCommand;
      }),
    [send]
  );

  useEffect(() => {
    if (status !== 'broadcasting' && status !== 'controlling') return;
    const renew = () => {
      if (!navigator.onLine) {
        return;
      }
      void leaseCommand('renew').catch(() => {});
    };
    const timer = setInterval(renew, 10_000);
    return () => {
      clearInterval(timer);
    };
  }, [status, leaseCommand]);

  useEffect(() => {
    const handleOffline = () => {
      authorityGeneration.current += 1;
      if (status !== 'legacy') {
        setStatus('not-broadcasting');
        setError('Disconnected; remote initiative may be stale');
      }
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [status]);

  useEffect(() => {
    if ((status !== 'broadcasting' && status !== 'controlling') || !current)
      return;
    const authority = authorityGeneration.current;
    const timeout = setTimeout(
      () => {
        if (
          authority === authorityGeneration.current &&
          currentRef.current?.leaseUntil !== undefined &&
          currentRef.current.leaseUntil <= Date.now()
        ) {
          authorityGeneration.current += 1;
          setStatus('not-broadcasting');
          setError(
            'Live control lease expired; remote initiative may be stale'
          );
        }
      },
      Math.max(0, current.leaseUntil - Date.now()) + 1
    );
    return () => clearTimeout(timeout);
  }, [current, status]);

  const refreshStatus = useCallback(async () => {
    const generation = contextGeneration.current;
    try {
      const control = await refresh();
      if (generation !== contextGeneration.current) return;
      setStatus(control ? 'not-broadcasting' : 'waiting');
      setError(null);
    } catch (failure) {
      if (generation !== contextGeneration.current) return;
      setStatus('error');
      setError(
        failure instanceof Error ? failure.message : 'Control unavailable'
      );
    }
  }, [refresh]);

  return {
    status,
    error,
    current,
    initialize,
    acquire: () => leaseCommand('acquire'),
    takeover: () => leaseCommand('takeover'),
    publish,
    refresh: refreshStatus,
  };
}
