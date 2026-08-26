'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Textarea } from '@/components/ui/forms/textarea';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
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
import type { MarkerKind } from '../markerData';
import { MARKER_KIND_ICONS } from '../markerIcons';
import { LootEditor } from './LootEditor';
import { MarkerRichText } from './MarkerRichText';
import type {
  MarkerDiscovery,
  MarkerDiscoverySkill,
  MarkerDisarmMethod,
  MarkerStatus,
  MarkerTrapMechanics,
  MarkerLootEntry,
  PublicMarkerLootEntry,
} from '@/types/battlemap';

const STATUS_OPTIONS: Record<
  MarkerKind,
  readonly { value: MarkerStatus; label: string }[]
> = {
  door: [
    { value: 'closed', label: 'Closed' },
    { value: 'open', label: 'Open' },
    { value: 'locked', label: 'Locked' },
  ],
  trap: [
    { value: 'armed', label: 'Armed' },
    { value: 'triggered', label: 'Triggered' },
    { value: 'disarmed', label: 'Disarmed' },
  ],
  loot: [
    { value: 'available', label: 'Available' },
    { value: 'claimed', label: 'Claimed' },
  ],
  npc: [
    { value: 'active', label: 'Active' },
    { value: 'defeated', label: 'Defeated / gone' },
  ],
  secret: [
    { value: 'hidden', label: 'Hidden' },
    { value: 'revealed', label: 'Revealed' },
  ],
  note: [
    { value: 'active', label: 'Active' },
    { value: 'resolved', label: 'Resolved' },
  ],
};

function defaultStatus(kind: MarkerKind): MarkerStatus {
  return STATUS_OPTIONS[kind][0].value;
}

function statusLabel(status: MarkerStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

interface EditFormProps {
  kind: MarkerKind;
  initialTitle: string;
  initialBody: string;
  initialDmNotes: string;
  initialStatus?: MarkerStatus;
  initialDiscovery?: MarkerDiscovery;
  initialTrap?: MarkerTrapMechanics;
  initialLoot?: MarkerLootEntry[];
  campaignCode?: string;
  dmId?: string;
  onSave?: (patch: {
    title: string;
    body: string;
    dmNotes: string;
    status: MarkerStatus;
    discovery?: MarkerDiscovery;
    trap?: MarkerTrapMechanics;
    loot?: MarkerLootEntry[];
  }) => void;
  onPersist?: EditFormProps['onSave'];
  onDelete?: () => void;
}

/**
 * The DM edit form. Keyed by the marker's `ref` from the parent (see the
 * `ready` / `missing-detail` branches below), so a different marker mounts a
 * fresh instance instead of reusing this one's local state — that is the
 * entire reset mechanism, deliberately not a `useEffect`.
 */
function EditForm({
  kind,
  initialTitle,
  initialBody,
  initialDmNotes,
  initialStatus,
  initialDiscovery,
  initialTrap,
  initialLoot,
  campaignCode,
  dmId,
  onSave,
  onPersist,
  onDelete,
}: EditFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [dmNotes, setDmNotes] = useState(initialDmNotes);
  const [status, setStatus] = useState<MarkerStatus>(
    initialStatus ?? defaultStatus(kind)
  );
  const [discoveryDc, setDiscoveryDc] = useState(
    initialDiscovery?.dc?.toString() ?? ''
  );
  const [discoverySkill, setDiscoverySkill] = useState<MarkerDiscoverySkill>(
    initialDiscovery?.skill ?? 'perception'
  );
  const [disarmDc, setDisarmDc] = useState(
    initialTrap?.disarmDc?.toString() ?? ''
  );
  const [disarmMethod, setDisarmMethod] = useState<MarkerDisarmMethod>(
    initialTrap?.disarmMethod ?? 'thieves-tools'
  );
  const [trigger, setTrigger] = useState(initialTrap?.trigger ?? '');
  const [effect, setEffect] = useState(initialTrap?.effect ?? '');
  const [damage, setDamage] = useState(initialTrap?.damage ?? '');
  const [loot, setLoot] = useState<MarkerLootEntry[]>(initialLoot ?? []);

  const parseDc = (value: string): number | undefined => {
    if (value.trim() === '') return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(40, Math.max(0, Math.round(parsed)));
  };

  const buildPatch = (lootValue: MarkerLootEntry[] = loot) => ({
    title,
    body,
    dmNotes,
    status,
    ...(kind === 'trap' || kind === 'secret'
      ? {
          discovery: {
            dc: parseDc(discoveryDc),
            skill: discoverySkill,
          },
        }
      : {}),
    ...(kind === 'trap'
      ? {
          trap: {
            disarmDc: parseDc(disarmDc),
            disarmMethod,
            trigger,
            effect,
            damage,
          },
        }
      : {}),
    ...(kind === 'loot' ? { loot: lootValue } : {}),
  });

  const handleSave = () => onSave?.(buildPatch());

  return (
    <div className="flex flex-col gap-4">
      <label className="text-body flex flex-col gap-1 text-sm font-medium">
        Status
        <select
          value={status}
          onChange={event => setStatus(event.target.value as MarkerStatus)}
          className="border-divider bg-surface text-body min-h-10 rounded-md border px-3"
        >
          {STATUS_OPTIONS[kind].map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {(kind === 'trap' || kind === 'secret') && (
        <div className="border-divider bg-surface-secondary grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <Input
            id="marker-discovery-dc"
            label="Discovery DC"
            type="number"
            min={0}
            max={40}
            value={discoveryDc}
            onChange={event => setDiscoveryDc(event.target.value)}
          />
          <label className="text-body flex flex-col gap-1 text-sm font-medium">
            Discovery skill
            <select
              value={discoverySkill}
              onChange={event =>
                setDiscoverySkill(event.target.value as MarkerDiscoverySkill)
              }
              className="border-divider bg-surface text-body min-h-10 rounded-md border px-3"
            >
              <option value="perception">Perception</option>
              <option value="investigation">Investigation</option>
            </select>
          </label>
        </div>
      )}
      {kind === 'trap' && (
        <div className="border-divider bg-surface-secondary grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <Input
            id="marker-disarm-dc"
            label="Disarm DC"
            type="number"
            min={0}
            max={40}
            value={disarmDc}
            onChange={event => setDisarmDc(event.target.value)}
          />
          <label className="text-body flex flex-col gap-1 text-sm font-medium">
            Disarm method
            <select
              value={disarmMethod}
              onChange={event =>
                setDisarmMethod(event.target.value as MarkerDisarmMethod)
              }
              className="border-divider bg-surface text-body min-h-10 rounded-md border px-3"
            >
              <option value="thieves-tools">Thieves&apos; Tools</option>
              <option value="sleight-of-hand">Sleight of Hand</option>
              <option value="arcana">Arcana</option>
              <option value="other">Other</option>
            </select>
          </label>
          <Input
            id="marker-trigger"
            label="Trigger"
            value={trigger}
            onChange={event => setTrigger(event.target.value)}
            placeholder="Opening the chest"
          />
          <Input
            id="marker-damage"
            label="Damage"
            value={damage}
            onChange={event => setDamage(event.target.value)}
            placeholder="2d10 poison"
          />
          <div className="sm:col-span-2">
            <Textarea
              id="marker-trap-effect"
              label="Trap effect"
              value={effect}
              onChange={event => setEffect(event.target.value)}
            />
          </div>
        </div>
      )}
      {kind === 'loot' && campaignCode && (
        <LootEditor
          campaignCode={campaignCode}
          dmId={dmId}
          value={loot}
          onChange={setLoot}
          onDelivered={next => {
            setLoot(next);
            onPersist?.(buildPatch(next));
          }}
        />
      )}
      <div className="text-heading space-y-1.5 text-sm font-medium">
        <p>Title</p>
        <CompactRichTextEditor
          content={title}
          onChange={setTitle}
          placeholder="Marker title…"
          minHeight="44px"
          ariaLabel="Title"
        />
      </div>
      <div className="text-heading space-y-1.5 text-sm font-medium">
        <p>Body</p>
        <CompactRichTextEditor
          content={body}
          onChange={setBody}
          placeholder="What players can learn…"
          ariaLabel="Body"
        />
      </div>
      <div className="text-heading space-y-1.5 text-sm font-medium">
        <p>DM notes — never shown to players</p>
        <CompactRichTextEditor
          content={dmNotes}
          onChange={setDmNotes}
          placeholder="Private notes…"
          ariaLabel="DM notes — never shown to players"
        />
      </div>
      <DialogFooter>
        <Button
          variant="danger"
          onClick={onDelete}
          className={MARKER_PANEL_TOUCH_TARGET_CLASS}
        >
          Delete
        </Button>
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

/** Player read-only view. Title, status and body ride as plain JSX children — React
 * renders string children as text nodes, never parsed markup — so this must
 * never be swapped for `dangerouslySetInnerHTML`. This component's prop type
 * only accepts `title` and `body` strings — `dmNotes` is intentionally never
 * passed to this component at all, and cannot be reached from inside it. */
function ReadOnlyView({
  title,
  body,
  status,
  loot,
  onClaimLoot,
}: {
  title: string;
  body: string;
  status?: MarkerStatus;
  loot?: PublicMarkerLootEntry[];
  onClaimLoot?: (entryId: string) => Promise<void>;
}) {
  const [claimingEntryId, setClaimingEntryId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);

  const handleClaim = async (entryId: string) => {
    if (!onClaimLoot || claimingEntryId) return;
    setClaimingEntryId(entryId);
    setClaimMessage(null);
    try {
      await onClaimLoot(entryId);
      setClaimMessage(
        'Claimed. The item will appear on your character shortly.'
      );
    } catch (error) {
      setClaimMessage(
        error instanceof Error ? error.message : 'Could not claim that item.'
      );
    } finally {
      setClaimingEntryId(null);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'text-heading text-lg font-semibold',
          MARKER_PANEL_CONTAINMENT_CLASS
        )}
      >
        <MarkerRichText content={title} />
      </div>
      {status && (
        <p className="text-accent-blue-text text-sm font-semibold">
          Status: {statusLabel(status)}
        </p>
      )}
      <div
        data-testid="marker-panel-body"
        className={cn('text-body text-sm', MARKER_PANEL_CONTAINMENT_CLASS)}
      >
        <MarkerRichText content={body} />
      </div>
      {loot && loot.length > 0 && (
        <ul className="border-divider divide-divider divide-y rounded-md border">
          {loot.map(entry => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 p-3 text-sm"
            >
              <span className="text-heading font-medium">{entry.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted">
                  {entry.remainingQuantity} available
                </span>
                {onClaimLoot && (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={
                      entry.remainingQuantity <= 0 || claimingEntryId !== null
                    }
                    onClick={() => void handleClaim(entry.id)}
                  >
                    {claimingEntryId === entry.id ? 'Claiming…' : 'Claim'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {claimMessage && (
        <p role="status" className="text-body text-sm">
          {claimMessage}
        </p>
      )}
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

function panelKind(state: MarkerPanelState): MarkerKind | undefined {
  if (
    state.kind === 'ready' ||
    state.kind === 'missing-detail' ||
    state.kind === 'unpublished'
  ) {
    return state.data.kind;
  }
  return undefined;
}

function renderPanelBody(
  mode: MarkerPanelMode,
  state: MarkerPanelState,
  onSave: MarkerDetailPanelProps['onSave'],
  onPersist: MarkerDetailPanelProps['onPersist'],
  onDelete: MarkerDetailPanelProps['onDelete'],
  isDmOnly: boolean | undefined,
  onAudienceChange: MarkerDetailPanelProps['onAudienceChange'],
  audienceNotice: string | null | undefined,
  campaignCode: string | undefined,
  dmId: string | undefined,
  onClaimLoot: MarkerDetailPanelProps['onClaimLoot']
) {
  if (state.kind === 'ready') {
    if (mode === 'dm') {
      return (
        <>
          {(state.data.kind === 'trap' || state.data.kind === 'secret') &&
            isDmOnly !== undefined && (
              <div className="border-divider bg-surface-secondary mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-heading text-sm font-semibold">
                    {isDmOnly ? 'Hidden from players' : 'Discovered'}
                  </p>
                  <p className="text-muted text-xs">
                    Visibility applies to every pin linked to this marker.
                  </p>
                </div>
                <Button
                  variant={isDmOnly ? 'primary' : 'warning'}
                  onClick={() => onAudienceChange?.(!isDmOnly)}
                  leftIcon={isDmOnly ? <Eye size={16} /> : <EyeOff size={16} />}
                  className={MARKER_PANEL_TOUCH_TARGET_CLASS}
                >
                  {isDmOnly ? 'Reveal to players' : 'Hide from players'}
                </Button>
                {audienceNotice && (
                  <p
                    role="alert"
                    className="text-accent-amber-text w-full text-xs"
                  >
                    {audienceNotice}
                  </p>
                )}
              </div>
            )}
          <EditForm
            key={state.data.ref}
            kind={state.data.kind}
            initialTitle={state.detail.title}
            initialBody={state.detail.body}
            initialDmNotes={state.detail.dmNotes ?? ''}
            initialStatus={state.detail.status}
            initialDiscovery={
              'discovery' in state.detail ? state.detail.discovery : undefined
            }
            initialTrap={'trap' in state.detail ? state.detail.trap : undefined}
            initialLoot={
              'loot' in state.detail &&
              state.detail.loot?.[0] &&
              'item' in state.detail.loot[0]
                ? (state.detail.loot as MarkerLootEntry[])
                : undefined
            }
            campaignCode={campaignCode}
            dmId={dmId}
            onSave={onSave}
            onPersist={onPersist}
            onDelete={onDelete}
          />
        </>
      );
    }
    return (
      <ReadOnlyView
        title={state.detail.title}
        body={state.detail.body}
        status={state.detail.status}
        loot={
          state.detail.loot?.[0] && 'remainingQuantity' in state.detail.loot[0]
            ? (state.detail.loot as PublicMarkerLootEntry[])
            : undefined
        }
        onClaimLoot={onClaimLoot}
      />
    );
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
          kind={state.data.kind}
          initialTitle=""
          initialBody=""
          initialDmNotes=""
          campaignCode={campaignCode}
          dmId={dmId}
          onSave={onSave}
          onPersist={onPersist}
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
  onPersist,
  onDelete,
  isDmOnly,
  onAudienceChange,
  audienceNotice,
  campaignCode,
  dmId,
  onClaimLoot,
}: MarkerDetailPanelProps): React.JSX.Element {
  const handleOpenChange = (next: boolean) => {
    if (!next) onClose();
  };

  const kind = panelKind(state);
  const KindIcon = kind === undefined ? undefined : MARKER_KIND_ICONS[kind];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2 capitalize">
              {KindIcon && <KindIcon aria-hidden="true" size={20} />}
              {panelTitle(state)}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Map marker details
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {renderPanelBody(
            mode,
            state,
            onSave,
            onPersist,
            onDelete,
            isDmOnly,
            onAudienceChange,
            audienceNotice,
            campaignCode,
            dmId,
            onClaimLoot
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
