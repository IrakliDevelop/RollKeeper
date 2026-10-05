'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/forms/button';
import {
  adoptTableScene,
  captureAdoptionPreview,
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

interface TableScenePanelProps {
  campaignCode: string;
  battleMaps: BattleMap[];
}

type Status = {
  kind: 'idle' | 'working' | 'success' | 'error';
  message: string;
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
      const preview = await captureAdoptionPreview({
        source,
        workspaceKey: repository.workspaceIdentity,
        sourceCampaignId: campaignCode,
        sourceMapId: map.id,
      });
      const result = await adoptTableScene({
        repository,
        source,
        preview,
        expectedRevision: current.snapshot.campaign?.revision ?? 0,
        operationId: `adopt:${campaignCode}:${map.id}`,
      });
      if (result.status === 'committed') {
        const live = await prepareTableSceneAuthority({
          campaignCode,
          dmId: useDmStore.getState().dmId,
          sceneId: result.sceneId,
          sourceMapId: map.id,
          workspaceInstanceId:
            repository.workspaceSelection.workspace.localWorkspaceId,
          contentRevision: result.revision,
          safeLabel: preview.scene.map.name,
          canvasState: preview.scene.canvasCheckpoint?.state ?? {},
          holderSessionId: getTableAuthoritySessionId(),
        });
        setStatus(
          live.status === 'prepared'
            ? {
                kind: 'success',
                message:
                  'Scene adopted and private authority prepared. Public presentation was not changed; the source records were not changed.',
              }
            : {
                kind: 'error',
                message: `Scene adopted locally, but private authority preparation failed (${live.reason}). Open the scene to retry or work offline.`,
              }
        );
        return;
      }
      setStatus(
        result.status === 'source-changed'
          ? {
              kind: 'error',
              message:
                'The source changed during preview. Review it and adopt again.',
            }
          : {
              kind: 'error',
              message: `Adoption did not complete (${result.status}).`,
            }
      );
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Adoption failed.',
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
      setStatus({ kind: 'success', message: 'Table bundle exported.' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Export failed.',
      });
    }
  }

  async function importBundle(file: File) {
    if (!repository) return;
    setStatus({ kind: 'working', message: 'Validating Table bundle…' });
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
              'Imported into a new local workspace. The active workspace was not overwritten.',
          }
        : {
            kind: 'error',
            message: `Import did not complete (${result.reason}).`,
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
            Scene runs are saved locally on this device. Export a Table bundle
            separately; character backups and legacy campaign backups do not
            include these scenes.
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
          Table storage is unavailable. Original battle maps remain available.
        </p>
      )}
      {current?.status === 'read-only' && (
        <p className="text-accent-orange-text mt-4 text-sm" role="status">
          This Table data uses an unsupported format. It is read-only; raw
          export remains available.
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
          This imported Table workspace is not bound to this campaign route. No
          private authority request was sent.
        </p>
      )}
      {selectedWorkspaceId && !routeRejected && (
        <p className="text-muted mt-4 text-sm" role="status">
          Imported Table workspace selected.{' '}
          <Link
            className="text-link underline"
            href={`/dm/campaign/${campaignCode}/battlemaps`}
          >
            Return to this campaign&apos;s Table workspace
          </Link>
          .
        </p>
      )}
      {importedWorkspaceId && !selectedWorkspaceId && (
        <p className="text-muted mt-4 text-sm" role="status">
          Import validated into a separate local workspace.{' '}
          <Link
            className="text-link underline"
            href={`/dm/campaign/${campaignCode}/battlemaps?tableWorkspace=${encodeURIComponent(importedWorkspaceId)}`}
          >
            Open imported workspace
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
                ? 'Local draft saved · authoritative checkpoint pending'
                : scene.canvasCheckpoint
                  ? scene.canvasCheckpoint.generation.startsWith('adoption:')
                    ? 'Local adoption checkpoint saved'
                    : 'Authoritative checkpoint committed locally'
                  : 'Ready to open'}
            </p>
            {changedScenes.has(scene.sceneId) && (
              <p className="text-accent-orange-text mt-1 text-xs" role="alert">
                Source changed
              </p>
            )}
            <Link
              href={`/dm/campaign/${campaignCode}/table/${scene.sceneId}${selectedWorkspaceId ? `?tableWorkspace=${encodeURIComponent(selectedWorkspaceId)}` : ''}`}
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
              {adopted ? `${map.name} adopted` : `Adopt ${map.name}`}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
