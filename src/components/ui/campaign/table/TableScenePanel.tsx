'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/forms/button';
import {
  adoptMapLocally,
  compareTableSceneSource,
  createPersistedLegacyTableAdoptionSource,
  type TableAdoptionSource,
} from '@/lib/table/adoption';
import {
  prepareTableSceneAuthority,
  getTableAuthoritySessionId,
} from '@/lib/table/authorityLifecycle';
import {
  exportRawTableWorkspace,
  exportTableBundle,
  importTableBundle,
} from '@/lib/table/bundle';
import { useDmStore } from '@/store/dmStore';
import type { BattleMap } from '@/types/battlemap';
import { isTableWorkspaceBoundToCampaign } from '@/lib/table/sceneAdapter';
import { useAuthenticatedTableWorkspace } from './useAuthenticatedTableWorkspace';
import { tableWorkspaceHref } from './workspace/tableWorkspaceRoutes';

interface TableScenePanelProps {
  campaignCode: string;
  battleMaps: BattleMap[];
}

type Status = {
  kind: 'idle' | 'working' | 'success' | 'error';
  message: string;
  /** O7-3: a raw outcome code, shown as a tooltip only. */
  detail?: string;
};

export function TableScenePanel({
  campaignCode,
  battleMaps,
}: TableScenePanelProps) {
  const searchParams = useSearchParams();
  const selectedWorkspaceId = searchParams.get('tableWorkspace');
  const {
    repository: openedRepository,
    revision,
    error,
  } = useAuthenticatedTableWorkspace({
    sourceCampaignCode: campaignCode,
    localWorkspaceId: selectedWorkspaceId,
  });
  const routeRejected = Boolean(
    selectedWorkspaceId &&
      openedRepository &&
      !isTableWorkspaceBoundToCampaign(
        openedRepository.workspaceSelection,
        campaignCode
      )
  );
  const repository = routeRejected ? null : openedRepository;
  const [status, setStatus] = useState<Status>({ kind: 'idle', message: '' });
  const [importedWorkspaceId, setImportedWorkspaceId] = useState<string | null>(
    null
  );
  const [changedScenes, setChangedScenes] = useState<Set<string>>(new Set());
  const importRef = useRef<HTMLInputElement>(null);

  const current = repository?.getCurrent();
  const scenes = current?.status === 'ready' ? current.snapshot.scenes : [];
  const mappings =
    current?.status === 'ready'
      ? (current.snapshot.campaign?.sourceMappings ?? [])
      : [];

  const source: TableAdoptionSource = useMemo(
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

  useEffect(() => {
    let cancelled = false;
    const latest = repository?.getCurrent();
    if (!repository || latest?.status !== 'ready') {
      setChangedScenes(new Set());
      return;
    }
    void Promise.all(
      latest.snapshot.scenes.map(async scene => ({
        sceneId: scene.sceneId,
        result: await compareTableSceneSource({
          repository,
          source,
          sceneId: scene.sceneId,
        }),
      }))
    ).then(results => {
      if (cancelled) return;
      setChangedScenes(
        new Set(
          results
            .filter(value => value.result.status === 'source-changed')
            .map(value => value.sceneId)
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [repository, revision, source]);

  async function adopt(map: BattleMap) {
    if (!repository || current?.status !== 'ready') return;
    setStatus({ kind: 'working', message: `Capturing ${map.name}…` });
    try {
      const result = await adoptMapLocally({
        repository,
        source,
        campaignCode,
        mapId: map.id,
      });
      if (result.status === 'committed') {
        // The battle-maps page keeps its PR01 composition (it drops the
        // session); the Table workspace adopts locally only (R3-F1).
        const live = await prepareTableSceneAuthority({
          campaignCode,
          dmId: useDmStore.getState().dmId,
          sceneId: result.sceneId,
          sourceMapId: map.id,
          workspaceInstanceId:
            repository.workspaceSelection.workspace.localWorkspaceId,
          contentRevision: result.revision,
          safeLabel: result.name,
          canvasState: result.canvasState,
          holderSessionId: getTableAuthoritySessionId(),
        });
        setStatus(
          live.status === 'prepared'
            ? {
                kind: 'success',
                message:
                  "Scene added to the Table. What players see and the original battle map weren't changed.",
              }
            : {
                kind: 'error',
                message:
                  "Scene added on this device, but it couldn't go live. Open the scene to try again or work offline.",
                detail: live.reason,
              }
        );
        return;
      }
      setStatus(
        result.status === 'source-changed'
          ? {
              kind: 'error',
              message:
                'The source changed during preview. Check it and add it again.',
            }
          : {
              kind: 'error',
              message: "The scene wasn't added.",
              detail: result.status,
            }
      );
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : "The scene couldn't be added.",
      });
    }
  }

  async function exportBundle() {
    if (!repository) return;
    try {
      const raw =
        repository.getCurrent()?.status === 'read-only'
          ? await exportRawTableWorkspace(repository)
          : await exportTableBundle(repository);
      const url = URL.createObjectURL(
        new Blob([raw], { type: 'application/json' })
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `rollkeeper-table-${campaignCode}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: 'success', message: 'Table exported.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Export failed.',
      });
    }
  }

  async function importBundle(file: File) {
    if (!repository) return;
    setStatus({ kind: 'working', message: 'Checking the file…' });
    const result = await importTableBundle({
      factory: repository.indexedDbFactory,
      account: repository.workspaceSelection.account,
      activeWorkspaceKey: repository.workspaceIdentity,
      targetCampaignCode: campaignCode,
      raw: await file.text(),
    });
    if (result.status === 'imported') {
      setImportedWorkspaceId(result.localWorkspaceId);
    }
    setStatus(
      result.status === 'imported'
        ? {
            kind: 'success',
            message:
              "Imported as a separate Table on this device. Your current Table wasn't changed.",
          }
        : {
            kind: 'error',
            message: "The import didn't finish.",
            detail: result.reason,
          }
    );
  }

  return (
    <section
      className="border-divider bg-surface-secondary mb-8 rounded-lg border p-5"
      aria-labelledby="table-scenes-heading"
      data-revision={revision}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            id="table-scenes-heading"
            className="text-heading text-lg font-semibold"
          >
            Table scenes
          </h2>
          <p className="text-muted mt-1 max-w-3xl text-sm">
            Scenes and fights are saved on this device only. Export them here:
            character backups and older campaign backups don&apos;t include
            them.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={exportBundle}
            disabled={
              !repository ||
              (current?.status !== 'read-only' && scenes.length === 0)
            }
          >
            Export Table
          </Button>
          <input
            ref={importRef}
            className="hidden"
            type="file"
            accept="application/json,.json"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void importBundle(file);
              event.target.value = '';
            }}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => importRef.current?.click()}
            disabled={!repository}
          >
            Import Table
          </Button>
        </div>
      </div>

      {current?.status === 'unavailable' && (
        <p className="text-accent-red-text mt-4 text-sm" role="alert">
          This device can&apos;t store Table data right now. Your battle maps
          are still available.
        </p>
      )}
      {current?.status === 'read-only' && (
        <p className="text-accent-orange-text mt-4 text-sm" role="status">
          This Table&apos;s data is in a format the app can&apos;t edit. You can
          still export it.
        </p>
      )}
      {status.message && (
        <p
          className={
            status.kind === 'error'
              ? 'text-accent-red-text mt-4 text-sm'
              : 'text-muted mt-4 text-sm'
          }
          role={status.kind === 'error' ? 'alert' : 'status'}
          title={status.detail}
        >
          {status.message}
        </p>
      )}
      {error && (
        <p className="text-accent-red-text mt-4 text-sm" role="alert">
          {error}
        </p>
      )}
      {routeRejected && (
        <p className="text-accent-red-text mt-4 text-sm" role="alert">
          This imported Table belongs to another campaign, so it can&apos;t go
          live here. Nothing was sent.
        </p>
      )}
      {selectedWorkspaceId && !routeRejected && (
        <p className="text-muted mt-4 text-sm" role="status">
          Imported Table selected.{' '}
          <Link
            className="text-link underline"
            href={`/dm/campaign/${campaignCode}/battlemaps`}
          >
            Back to this campaign&apos;s Table
          </Link>
          .
        </p>
      )}
      {importedWorkspaceId && !selectedWorkspaceId && (
        <p className="text-muted mt-4 text-sm" role="status">
          Import checked and saved as a separate Table.{' '}
          <Link
            className="text-link underline"
            href={`/dm/campaign/${campaignCode}/battlemaps?tableWorkspace=${encodeURIComponent(importedWorkspaceId)}`}
          >
            Open imported Table
          </Link>
          .
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {scenes.map(scene => (
          <div
            key={scene.sceneId}
            className="border-divider bg-surface rounded-md border p-3"
          >
            <p className="text-heading font-medium">{scene.map.name}</p>
            <p className="text-muted mt-1 text-xs">
              {scene.localDraft
                ? 'Changes not in a checkpoint yet'
                : scene.canvasCheckpoint
                  ? scene.canvasCheckpoint.generation.startsWith('adoption:')
                    ? 'Starting copy saved'
                    : 'Checkpoint saved'
                  : 'Ready to open'}
            </p>
            {changedScenes.has(scene.sceneId) && (
              <p className="text-accent-orange-text mt-1 text-xs" role="alert">
                Source changed
              </p>
            )}
            <Link
              href={tableWorkspaceHref(campaignCode, {
                scene: scene.sceneId,
                tableWorkspace: selectedWorkspaceId,
              })}
              className="mt-3 inline-block"
            >
              <Button variant="primary" size="sm">
                Open scene
              </Button>
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {battleMaps.map(map => {
          const adopted = mappings.some(
            mapping =>
              mapping.sourceCampaignId === campaignCode &&
              mapping.sourceMapId === map.id
          );
          return (
            <Button
              key={map.id}
              variant="ghost"
              size="sm"
              disabled={
                !repository ||
                selectedWorkspaceId !== null ||
                adopted ||
                status.kind === 'working'
              }
              onClick={() => void adopt(map)}
            >
              {adopted ? `${map.name} added` : `Add ${map.name} to Table`}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
