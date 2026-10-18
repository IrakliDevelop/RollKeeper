'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import * as Popover from '@radix-ui/react-popover';

import { Button } from '@/components/ui/forms/button';
import type {
  TableOfflineForkV1,
  TableSceneRecordV1,
} from '@/lib/table/schema';

import type { useSceneCheckpointActions } from './useSceneCheckpointActions';

export const WORKSPACE_LABEL =
  'Scenes and fights are saved on this device only.';

/** O7-3: plain words for the connection state; the raw value is a tooltip. */
const CONNECTION_LABEL: Record<string, string> = {
  live: 'Connected',
  connecting: 'Connecting…',
  recovering: 'Reconnecting…',
  offline: 'Offline',
  denied: 'Not allowed',
  'upgrade-required': 'Update needed',
  stopped: 'Stopped',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const focusables = (root: ParentNode | null): HTMLElement[] =>
  root
    ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        item => item.tabIndex >= 0
      )
    : [];

type Checkpoint = ReturnType<typeof useSceneCheckpointActions>;

function checkpointLine(scene: TableSceneRecordV1 | undefined): string {
  if (!scene?.canvasCheckpoint) return 'None yet';
  return scene.canvasCheckpoint.generation.startsWith('adoption:')
    ? 'Not saved yet (starting copy available)'
    : 'Saved';
}

function savedTime(savedAt: string): string {
  return new Date(savedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * GG3: the scene's offline changes slot. It stays until reapplied or
 * discarded; later edits and checkpoints never touch it.
 */
function OfflineForkSection(props: {
  fork: TableOfflineForkV1;
  checkpoint: Pick<
    Checkpoint,
    'recoveryBusy' | 'live' | 'reapplyOfflineFork' | 'discardOfflineFork'
  >;
}) {
  const { fork, checkpoint } = props;
  return (
    <div className="border-divider flex flex-col gap-1 border-t pt-2">
      <p className="text-heading font-semibold">
        Offline changes from {savedTime(fork.savedAt)}
      </p>
      <p className="text-muted">
        The live map did not take these edits. Reapply them to send them to
        players, or discard them.
      </p>
      {fork.replacedEarlier && (
        <p className="text-muted">
          These replaced earlier offline changes that were not reapplied.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={checkpoint.recoveryBusy || !checkpoint.live}
          onClick={() => void checkpoint.reapplyOfflineFork(fork)}
        >
          Reapply offline changes
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={checkpoint.recoveryBusy}
          onClick={() => void checkpoint.discardOfflineFork(fork)}
        >
          Discard
        </Button>
      </div>
    </div>
  );
}

/**
 * O7-2 H3 / HR-5 / HN-2: on-demand diagnostics and recovery actions for the
 * selected scene, at every breakpoint. Only these collapse (FC-1): alerts,
 * notices and save results stay header banners. The trigger counts what is
 * actionable here (a local draft to reapply, a failed last save).
 */
export function TableHeaderDetails(props: {
  relayStatus: string;
  stored: TableSceneRecordV1 | undefined;
  /** Hoisted by the workspace so a canvas re-mint cannot erase a click. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  checkpoint: Pick<
    Checkpoint,
    | 'saveMessage'
    | 'saveTone'
    | 'recoveryBusy'
    | 'saveBusy'
    | 'live'
    | 'restore'
    | 'reapplyOfflineFork'
    | 'discardOfflineFork'
    | 'saveCheckpoint'
  >;
}) {
  const { stored, checkpoint } = props;
  const [localOpen, setLocalOpen] = useState(false);
  const open = props.open ?? localOpen;
  const setOpen = (next: boolean) => {
    if (props.open === undefined) setLocalOpen(next);
    props.onOpenChange?.(next);
  };
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const skipReturnFocus = useRef(false);
  const draft = stored?.localDraft;
  const saved = stored?.canvasCheckpoint;
  const offlineFork = stored?.offlineFork ?? null;
  const attention =
    (draft ? 1 : 0) +
    (offlineFork ? 1 : 0) +
    (checkpoint.saveTone === 'failure' ? 1 : 0);
  const busy = checkpoint.recoveryBusy || checkpoint.saveBusy;

  // HN-2: a focused control that unmounts hands focus to the first
  // remaining control, else to the trigger.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const previous = lastFocused.current;
    if (!open || !content || !previous || previous.isConnected) return;
    lastFocused.current = null;
    (focusables(content)[0] ?? triggerRef.current)?.focus();
  }, [open, draft, saved, offlineFork, busy]);

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Tab') return;
    const items = focusables(contentRef.current);
    if (event.shiftKey && event.target === items[0]) {
      event.preventDefault();
      triggerRef.current?.focus();
    } else if (!event.shiftKey && event.target === items.at(-1)) {
      // FC-4 pattern: leaving forward closes and continues after the trigger.
      event.preventDefault();
      const content = contentRef.current;
      // N3: skip controls that are not rendered (display:none ancestors).
      const order = focusables(document.body).filter(
        item =>
          !content?.contains(item) &&
          (typeof item.checkVisibility !== 'function' || item.checkVisibility())
      );
      const trigger = triggerRef.current;
      const next = trigger ? order[order.indexOf(trigger) + 1] : undefined;
      skipReturnFocus.current = true;
      setOpen(false);
      (next ?? trigger)?.focus();
    }
  };

  const label =
    attention > 0
      ? `Details (${attention}): ${attention} item${attention === 1 ? ' needs' : 's need'} attention`
      : 'Details';
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button ref={triggerRef} variant="ghost" size="sm" aria-label={label}>
          {attention > 0 ? `Details (${attention})` : 'Details'}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={contentRef}
          data-testid="table-header-details"
          align="end"
          sideOffset={4}
          collisionPadding={8}
          style={{ maxWidth: 'calc(100vw - 16px)' }}
          className="bg-surface-raised text-body border-divider z-50 flex w-80 flex-col gap-2 rounded-lg border p-3 text-xs shadow-lg outline-none"
          onOpenAutoFocus={event => {
            event.preventDefault();
            focusables(contentRef.current)[0]?.focus();
          }}
          onCloseAutoFocus={event => {
            if (!skipReturnFocus.current) return;
            skipReturnFocus.current = false;
            event.preventDefault();
          }}
          onFocusCapture={event => {
            lastFocused.current = event.target as HTMLElement;
          }}
          onKeyDown={onKeyDown}
        >
          <p className="text-heading text-sm font-semibold">
            {WORKSPACE_LABEL}
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">Connection</dt>
            <dd title={props.relayStatus}>
              {CONNECTION_LABEL[props.relayStatus] ?? props.relayStatus}
            </dd>
            <dt className="text-muted">Changes not in a checkpoint yet</dt>
            <dd>{draft ? 'Yes, saved on this device' : 'None'}</dd>
            <dt className="text-muted">Checkpoint</dt>
            <dd>{checkpointLine(stored)}</dd>
          </dl>
          {checkpoint.saveTone === 'routine' && (
            <p className="text-muted">{checkpoint.saveMessage}</p>
          )}
          {checkpoint.recoveryBusy && <p className="text-muted">Restoring…</p>}
          {checkpoint.saveBusy && (
            <p className="text-muted">Saving checkpoint…</p>
          )}
          {!checkpoint.live && (draft || saved || offlineFork) && (
            <p className="text-muted">
              Only the live tab can restore. Go live first.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {draft && (
              <Button
                variant="outline"
                size="sm"
                disabled={checkpoint.recoveryBusy || !checkpoint.live}
                onClick={() => void checkpoint.restore(draft, 'changes')}
              >
                Reapply latest changes
              </Button>
            )}
            {saved && (
              <Button
                variant="outline"
                size="sm"
                disabled={checkpoint.recoveryBusy || !checkpoint.live}
                onClick={() => void checkpoint.restore(saved, 'checkpoint')}
              >
                Restore checkpoint
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={checkpoint.saveBusy}
              onClick={() => void checkpoint.saveCheckpoint()}
            >
              Save checkpoint
            </Button>
          </div>
          {draft && (
            <p className="text-muted">
              Reapply latest changes sends the map as this device last saved it.
            </p>
          )}
          {offlineFork && (
            <OfflineForkSection fork={offlineFork} checkpoint={checkpoint} />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
