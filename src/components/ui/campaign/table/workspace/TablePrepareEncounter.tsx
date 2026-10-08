'use client';

import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/forms/button';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { useHydration } from '@/hooks/useHydration';
import {
  copiedEncounterEntities,
  encounterCopySnapshot,
  runCombatCommand,
} from '@/lib/table/combat';
import type { TableRepository } from '@/lib/table/repository';
import type { TableSceneRecordV1 } from '@/lib/table/schema';
import { useEncounterStore } from '@/store/encounterStore';

import type { TableWorkspaceQuery } from './tableWorkspaceRoutes';

const LABEL_MAX = 200;

/**
 * PR06 W7 "Prepare on map" (A3 copy semantics): with `?prepareEncounter=`
 * the workspace asks the DM to choose or create a scene, then — only after
 * an explicit confirmation — copies the library encounter's creatures into
 * that scene as a new inactive run and selects it. An existing copy in the
 * scene is offered first; another copy is explicit. The library encounter
 * is only read. Without the parameter nothing here renders (peaceful scene).
 */
export function TablePrepareEncounter(props: {
  encounterId: string;
  campaignCode: string;
  repository: TableRepository;
  scene: TableSceneRecordV1 | undefined;
  navigate: (
    mode: 'push' | 'replace',
    next: Partial<TableWorkspaceQuery>
  ) => void;
}) {
  const hydrated = useHydration();
  const encounter = useEncounterStore(state =>
    state.encounters.find(item => item.id === props.encounterId)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosenRun, setChosenRun] = useState<string | null>(null);
  const { scene, navigate } = props;
  const cancel = () => navigate('replace', { scene: scene?.sceneId ?? null });

  const cancelButton = (
    <Button variant="ghost" size="sm" onClick={cancel}>
      Cancel prepare
    </Button>
  );
  const frame = (content: ReactNode) => (
    <div
      role="region"
      aria-label="Prepare encounter"
      className="border-accent-blue-border bg-accent-blue-bg flex w-full flex-wrap items-center gap-2 rounded-lg border p-2"
    >
      {content}
    </div>
  );

  if (!hydrated)
    return frame(<p className="text-muted text-xs">Loading encounter…</p>);
  if (!encounter || encounter.campaignCode !== props.campaignCode)
    return frame(
      <>
        <p className="text-accent-amber-text text-sm" role="status">
          Encounter not found
        </p>
        {cancelButton}
      </>
    );

  const current = props.repository.getCurrent();
  const snapshot = current?.status === 'ready' ? current.snapshot : null;
  const deleted = new Set(
    snapshot?.tombstones
      .filter(tombstone => tombstone.kind === 'encounter')
      .map(tombstone => tombstone.id) ?? []
  );
  const existing = scene
    ? (snapshot?.encounters ?? [])
        .filter(
          run =>
            run.sceneId === scene.sceneId &&
            run.sourceEncounterId === encounter.id &&
            !deleted.has(run.runId)
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    : [];
  const selectedRun =
    existing.find(run => run.runId === chosenRun) ?? existing[0];

  async function copy() {
    if (!scene || !encounter) return;
    setBusy(true);
    setError(null);
    try {
      const snapshotCopy = encounterCopySnapshot(encounter);
      const runId = crypto.randomUUID();
      const name = encounter.name.trim();
      const label = name
        ? [...name].slice(0, LABEL_MAX).join('')
        : 'Encounter copy';
      const latest = props.repository.getCurrent();
      const result = await runCombatCommand(props.repository, {
        expectedRevision:
          latest?.status === 'ready'
            ? (latest.snapshot.campaign?.revision ?? 0)
            : 0,
        operationId: `encounter-copy:${runId}`,
        command: {
          type: 'combat.createRunFromEncounter',
          sceneId: scene.sceneId,
          runId,
          label,
          encounter: snapshotCopy,
          sceneMemberIds: copiedEncounterEntities(snapshotCopy).map(() =>
            crypto.randomUUID()
          ),
          at: new Date().toISOString(),
        },
      });
      if (result.status !== 'committed') {
        setError(
          `The encounter was not copied (${result.status}). Nothing changed.`
        );
        return;
      }
      navigate('replace', { scene: scene.sceneId, run: runId });
    } finally {
      setBusy(false);
    }
  }

  if (!scene)
    return frame(
      <>
        <p className="text-heading text-sm font-medium">
          {`Prepare ${encounter.name}: choose a scene or create one`}
        </p>
        {cancelButton}
      </>
    );

  return frame(
    <>
      <p className="text-heading w-full text-sm font-medium">
        {`Prepare ${encounter.name}: choose a scene or create one`}
      </p>
      {existing.length === 0 ? (
        <Button size="sm" disabled={busy} onClick={() => void copy()}>
          {`Copy ${encounter.name} into ${scene.map.name}`}
        </Button>
      ) : (
        <>
          <p className="text-body text-xs">
            {`${scene.map.name} already has ${existing.length} cop${existing.length === 1 ? 'y' : 'ies'} of this encounter.`}
          </p>
          {existing.length > 1 && (
            <SelectField
              label="Existing copies"
              wrapperClassName="w-auto min-w-[12rem]"
              value={selectedRun?.runId}
              onValueChange={setChosenRun}
              triggerProps={{ 'aria-label': 'Existing copies', size: 'sm' }}
            >
              {existing.map(run => (
                <SelectItem key={run.runId} value={run.runId}>
                  {`${run.label ?? 'Scene run'} · ${new Date(run.createdAt).toLocaleDateString()}`}
                </SelectItem>
              ))}
            </SelectField>
          )}
          <Button
            size="sm"
            disabled={busy || !selectedRun}
            onClick={() =>
              selectedRun &&
              navigate('replace', {
                scene: scene.sceneId,
                run: selectedRun.runId,
              })
            }
          >
            Open existing run
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void copy()}
          >
            Create another copy
          </Button>
        </>
      )}
      {cancelButton}
      {error && (
        <p role="alert" className="text-accent-red-text w-full text-xs">
          {error}
        </p>
      )}
    </>
  );
}
