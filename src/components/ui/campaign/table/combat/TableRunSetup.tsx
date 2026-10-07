'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/forms/button';
import type { TableCombatReadModel } from '@/lib/table/combatReadModel';

import { TableParticipantRow } from './TableParticipantRow';

/**
 * Inactive-run content of the Initiative tab: participants with manual
 * initiatives, bystanders, start gating and the imported-state reset.
 */
export function TableRunSetup(props: {
  model: TableCombatReadModel;
  bystanders: Array<{ actorId: string; name: string }>;
  activeElsewhere: {
    runId: string;
    label: string;
    sameScene: boolean;
    sceneName: string;
    href: string;
  } | null;
  missingPrompt: string[] | null;
  busy: boolean;
  onChooseParticipants: () => void;
  onInitiative: (actorId: string, value: number | null) => void;
  onHidden: (actorId: string, hidden: boolean) => void;
  onStart: () => void;
  /** P8: offered only to the holder while this scene is not shown. */
  onShowAndStart?: () => void;
  onResetImported: () => void;
  onGoToActive: () => void;
}) {
  const { model } = props;
  if (model.importedActive) {
    return (
      <div className="space-y-2 px-3 py-4">
        <p className="text-accent-amber-text text-xs font-medium">
          Imported as active — not running here
        </p>
        <p className="text-muted text-xs">
          This run was adopted while its original encounter was in combat. Reset
          the imported state to prepare and start it here.
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={props.busy}
          onClick={props.onResetImported}
        >
          Reset imported state
        </Button>
      </div>
    );
  }
  const participants = model.run.participants.map(
    participant =>
      model.participants.find(view => view.actorId === participant.actorId)!
  );
  return (
    <div className="space-y-3 px-2 py-3">
      {props.activeElsewhere && (
        <div className="border-accent-amber-border rounded-lg border p-2">
          <p className="text-accent-amber-text text-xs">
            {`Another run is active: ${props.activeElsewhere.label}${
              props.activeElsewhere.sameScene
                ? ''
                : ` (scene ${props.activeElsewhere.sceneName})`
            }`}
          </p>
          {props.activeElsewhere.sameScene ? (
            <Button variant="link" size="sm" onClick={props.onGoToActive}>
              Go to active run
            </Button>
          ) : (
            <Link
              className="text-accent-blue-text text-xs font-medium underline"
              href={props.activeElsewhere.href}
            >
              Go to active run
            </Link>
          )}
        </div>
      )}
      {participants.length === 0 ? (
        <p className="text-muted px-1 text-xs">No participants chosen yet.</p>
      ) : (
        <ul className="space-y-1" aria-label="Participants">
          {participants.map(view => (
            <TableParticipantRow
              key={view.entityId}
              view={view}
              highlightMissing={props.missingPrompt !== null}
              disabled={props.busy}
              onInitiative={value => props.onInitiative(view.actorId, value)}
              onHidden={hidden => props.onHidden(view.actorId, hidden)}
            />
          ))}
        </ul>
      )}
      {props.bystanders.length > 0 && (
        <ul className="space-y-0.5 px-1" aria-label="Bystanders">
          {props.bystanders.map(bystander => (
            <li key={bystander.actorId} className="text-faint text-xs">
              {`${bystander.name} · Bystander — not in initiative`}
            </li>
          ))}
        </ul>
      )}
      {props.missingPrompt && props.missingPrompt.length > 0 && (
        <p role="alert" className="text-accent-red-text px-1 text-xs">
          {`Missing initiative: ${props.missingPrompt.join(', ')}. Enter a roll (0 is valid) before starting.`}
        </p>
      )}
      <div className="flex flex-wrap gap-2 px-1">
        <Button
          variant="outline"
          size="sm"
          onClick={props.onChooseParticipants}
        >
          Choose participants
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={props.activeElsewhere !== null || participants.length === 0}
          onClick={props.onStart}
        >
          Start combat
        </Button>
        {props.onShowAndStart && (
          <Button
            variant="outline"
            size="sm"
            disabled={
              props.busy ||
              props.activeElsewhere !== null ||
              participants.length === 0
            }
            onClick={props.onShowAndStart}
          >
            Show scene and start combat
          </Button>
        )}
      </div>
    </div>
  );
}
