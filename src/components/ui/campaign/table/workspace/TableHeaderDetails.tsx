'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import * as Popover from '@radix-ui/react-popover';

import { Button } from '@/components/ui/forms/button';
import type { TableSceneRecordV1 } from '@/lib/table/schema';

import type { useSceneCheckpointActions } from './useSceneCheckpointActions';

export const WORKSPACE_LABEL = 'Saved on this device — scene runs are local';

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
  if (!scene?.canvasCheckpoint) return 'none';
  return scene.canvasCheckpoint.generation.startsWith('adoption:')
    ? 'not yet committed (local adoption snapshot available)'
    : 'committed locally';
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
  checkpoint: Pick<
    Checkpoint,
    | 'saveMessage'
    | 'saveTone'
    | 'recoveryBusy'
    | 'saveBusy'
    | 'restore'
    | 'saveCheckpoint'
  >;
}) {
  const { stored, checkpoint } = props;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const skipReturnFocus = useRef(false);
  const draft = stored?.localDraft;
  const saved = stored?.canvasCheckpoint;
  const attention =
    (draft ? 1 : 0) + (checkpoint.saveTone === 'failure' ? 1 : 0);
  const busy = checkpoint.recoveryBusy || checkpoint.saveBusy;

  // HN-2: a focused control that unmounts hands focus to the first
  // remaining control, else to the trigger.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const previous = lastFocused.current;
    if (!open || !content || !previous || previous.isConnected) return;
    lastFocused.current = null;
    (focusables(content)[0] ?? triggerRef.current)?.focus();
  }, [open, draft, saved, busy]);

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
      const order = focusables(document.body).filter(
        item => !content?.contains(item)
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
      ? `Details (${attention}) — ${attention} item${attention === 1 ? ' needs' : 's need'} attention`
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
            <dt className="text-muted">Relay</dt>
            <dd>{props.relayStatus}</dd>
            <dt className="text-muted">Local draft</dt>
            <dd>{draft ? 'saved · local operations pending' : 'none'}</dd>
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
          <div className="flex flex-wrap gap-2">
            {draft && (
              <Button
                variant="outline"
                size="sm"
                disabled={checkpoint.recoveryBusy}
                onClick={() => void checkpoint.restore(draft, 'Local draft')}
              >
                Reapply local draft
              </Button>
            )}
            {saved && (
              <Button
                variant="outline"
                size="sm"
                disabled={checkpoint.recoveryBusy}
                onClick={() =>
                  void checkpoint.restore(saved, 'Saved checkpoint')
                }
              >
                Restore saved checkpoint
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
