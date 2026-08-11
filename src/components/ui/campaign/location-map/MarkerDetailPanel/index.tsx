'use client';

import React, { useState } from 'react';

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { cn } from '@/utils/cn';

import {
  MARKER_PANEL_CONTAINMENT_CLASS,
  MARKER_PANEL_TOUCH_TARGET_CLASS,
} from './MarkerDetailPanel.utils';
import type {
  MarkerDetailPanelProps,
  MarkerPanelMode,
  MarkerPanelState,
} from './MarkerDetailPanel.types';

interface EditFormProps {
  initialTitle: string;
  initialBody: string;
  initialDmNotes: string;
  onSave?: (patch: { title: string; body: string; dmNotes: string }) => void;
  onDelete?: () => void;
}

/**
 * The DM edit form. Keyed by the marker's `ref` from the parent (see the
 * `ready` / `missing-detail` branches below), so a different marker mounts a
 * fresh instance instead of reusing this one's local state — that is the
 * entire reset mechanism, deliberately not a `useEffect`.
 */
function EditForm({
  initialTitle,
  initialBody,
  initialDmNotes,
  onSave,
  onDelete,
}: EditFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [dmNotes, setDmNotes] = useState(initialDmNotes);

  const handleSave = () => onSave?.({ title, body, dmNotes });

  return (
    <div className="flex flex-col gap-4">
      <Input
        id="marker-panel-title"
        label="Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
      />
      <Textarea
        id="marker-panel-body-field"
        label="Body"
        value={body}
        onChange={e => setBody(e.target.value)}
      />
      <Textarea
        id="marker-panel-dm-notes"
        label="DM notes — never shown to players"
        value={dmNotes}
        onChange={e => setDmNotes(e.target.value)}
      />
      <DialogFooter>
        <Button
          variant="danger"
          onClick={onDelete}
          className={MARKER_PANEL_TOUCH_TARGET_CLASS}
        >
          Delete
        </Button>
        <DialogClose asChild>
          <Button
            variant="secondary"
            className={MARKER_PANEL_TOUCH_TARGET_CLASS}
          >
            Close
          </Button>
        </DialogClose>
        <Button
          variant="primary"
          onClick={handleSave}
          className={MARKER_PANEL_TOUCH_TARGET_CLASS}
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Player read-only view. Title and body ride as plain JSX children — React
 * renders string children as text nodes, never parsed markup — so this must
 * never be swapped for `dangerouslySetInnerHTML`. This component's prop type
 * only accepts `title` and `body` strings — `dmNotes` is intentionally never
 * passed to this component at all, and cannot be reached from inside it. */
function ReadOnlyView({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-3">
      <h3
        className={cn(
          'text-heading text-lg font-semibold',
          MARKER_PANEL_CONTAINMENT_CLASS
        )}
      >
        {title}
      </h3>
      <div
        data-testid="marker-panel-body"
        className={cn('text-body text-sm', MARKER_PANEL_CONTAINMENT_CLASS)}
      >
        {body}
      </div>
    </div>
  );
}

/** Title bar text. Only `ready` / `missing-detail` / `unpublished` carry the
 * live element `data` (kind + label); `invalid-data` and
 * `unsupported-version` could not be parsed, so they fall back to a generic
 * label. */
function panelTitle(state: MarkerPanelState): string {
  if (
    state.kind === 'ready' ||
    state.kind === 'missing-detail' ||
    state.kind === 'unpublished'
  ) {
    return state.data.label ?? state.data.kind;
  }
  return 'Marker';
}

function renderPanelBody(
  mode: MarkerPanelMode,
  state: MarkerPanelState,
  onSave: MarkerDetailPanelProps['onSave'],
  onDelete: MarkerDetailPanelProps['onDelete']
) {
  if (state.kind === 'ready') {
    if (mode === 'dm') {
      return (
        <EditForm
          key={state.data.ref}
          initialTitle={state.detail.title}
          initialBody={state.detail.body}
          initialDmNotes={state.detail.dmNotes}
          onSave={onSave}
          onDelete={onDelete}
        />
      );
    }
    return <ReadOnlyView title={state.detail.title} body={state.detail.body} />;
  }

  if (state.kind === 'missing-detail') {
    // The resolver only ever produces `missing-detail` in DM mode (player
    // mode gets `unpublished` instead), but this branch must not depend on
    // callers upholding that — a `missing-detail` state paired with
    // `mode === 'player'` must never surface the DM edit form or DM notes.
    if (mode !== 'dm') {
      const name = state.data.label ?? state.data.kind;
      return (
        <p
          data-testid="marker-panel-state-missing-detail"
          className="text-body text-sm"
        >
          Not published yet — the DM hasn&apos;t shared details for this &quot;
          {name}&quot; marker.
        </p>
      );
    }
    return (
      <div data-testid="marker-panel-state-missing-detail">
        <p className="text-body mb-3 text-sm">
          This pin doesn&apos;t have details yet — add them below.
        </p>
        <EditForm
          key={state.data.ref}
          initialTitle=""
          initialBody=""
          initialDmNotes=""
          onSave={onSave}
          onDelete={onDelete}
        />
      </div>
    );
  }

  if (state.kind === 'unpublished') {
    const name = state.data.label ?? state.data.kind;
    return (
      <p
        data-testid="marker-panel-state-unpublished"
        className="text-body text-sm"
      >
        Not published yet — the DM hasn&apos;t shared details for this &quot;
        {name}&quot; marker.
      </p>
    );
  }

  if (state.kind === 'invalid-data') {
    return (
      <p
        data-testid="marker-panel-state-invalid-data"
        className="text-body text-sm"
      >
        This marker&apos;s data could not be read and cannot be displayed.
      </p>
    );
  }

  return (
    <p
      data-testid="marker-panel-state-unsupported-version"
      className="text-body text-sm"
    >
      This marker was created by a newer version of RollKeeper and can&apos;t be
      displayed here.
    </p>
  );
}

/**
 * DM edit view and read-only player view for one map marker, plus the five
 * typed states from `resolveMarkerPanelState`. `dmNotes` is only ever read
 * from `state` inside the DM edit branch — see `ReadOnlyView`, which never
 * receives it.
 */
export default function MarkerDetailPanel({
  open,
  mode,
  state,
  onClose,
  onSave,
  onDelete,
}: MarkerDetailPanelProps): React.JSX.Element {
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const isEditing =
    mode === 'dm' &&
    (state.kind === 'ready' || state.kind === 'missing-detail');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{panelTitle(state)}</DialogTitle>
          <DialogDescription className="sr-only">
            Map marker details
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {renderPanelBody(mode, state, onSave, onDelete)}
        </DialogBody>
        {!isEditing && (
          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="ghost"
                className={MARKER_PANEL_TOUCH_TARGET_CLASS}
              >
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
