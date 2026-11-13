'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  Map,
  MapPin,
  ExternalLink,
  Lock,
  Minus,
  Plus,
} from 'lucide-react';

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
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Textarea } from '@/components/ui/forms/textarea';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { cn } from '@/utils/cn';

import { MARKER_PANEL_CONTAINMENT_CLASS } from './MarkerDetailPanel.utils';
import type {
  MarkerDetailPanelProps,
  MarkerPanelMode,
  MarkerPanelState,
  ResolvedPortalState,
} from './MarkerDetailPanel.types';
import { MARKER_KIND_LABELS, type MarkerKind } from '../markerData';
import { MARKER_KIND_ICONS } from '../markerIcons';
import { buildMarkerPortalTarget } from '../markerPortal';
import { LootEditor } from './LootEditor';
import { MarkerRichText } from './MarkerRichText';
import type {
  MarkerDetail,
  MarkerDiscovery,
  MarkerDiscoverySkill,
  MarkerDisarmMethod,
  MarkerStatus,
  MarkerTrapMechanics,
  MarkerLootEntry,
  MarkerPortalTargetV1,
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
  initialLootAccess?: MarkerDetail['lootAccess'];
  portalState?: ResolvedPortalState;
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
    lootAccess?: MarkerDetail['lootAccess'];
    portal?: MarkerPortalTargetV1 | null;
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
  initialLootAccess,
  portalState,
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
  const [discoveryDc, setDiscoveryDc] = useState<number | undefined>(
    initialDiscovery?.dc
  );
  const [discoverySkill, setDiscoverySkill] = useState<MarkerDiscoverySkill>(
    initialDiscovery?.skill ?? 'perception'
  );
  const [disarmDc, setDisarmDc] = useState<number | undefined>(
    initialTrap?.disarmDc
  );
  const [disarmMethod, setDisarmMethod] = useState<MarkerDisarmMethod>(
    initialTrap?.disarmMethod ?? 'thieves-tools'
  );
  const [trigger, setTrigger] = useState(initialTrap?.trigger ?? '');
  const [effect, setEffect] = useState(initialTrap?.effect ?? '');
  const [damage, setDamage] = useState(initialTrap?.damage ?? '');
  const [loot, setLoot] = useState<MarkerLootEntry[]>(initialLoot ?? []);
  const [lootAccess, setLootAccess] = useState<'locked' | 'open'>(
    initialLootAccess ?? 'open'
  );

  const [portalTouched, setPortalTouched] = useState(false);
  const [portalDraftKind, setPortalDraftKind] = useState<
    'none' | 'battlemap' | 'location'
  >(portalState?.target?.kind ?? 'none');
  const [portalDraftId, setPortalDraftId] = useState<string>(
    portalState?.target?.id ?? ''
  );

  const parseDc = (value: number | undefined): number | undefined =>
    value === undefined
      ? undefined
      : Math.min(40, Math.max(0, Math.round(value)));

  function buildPortalPatch(): { portal?: MarkerPortalTargetV1 | null } {
    if (!portalTouched) return {};
    if (portalDraftKind === 'none') return { portal: null };
    if (!portalDraftId) return {}; // half-target: omit
    return { portal: buildMarkerPortalTarget(portalDraftKind, portalDraftId) };
  }

  const buildPatch = (
    lootValue: MarkerLootEntry[] = loot,
    accessValue: 'locked' | 'open' = lootAccess
  ) => ({
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
    ...(kind === 'loot' ? { loot: lootValue, lootAccess: accessValue } : {}),
    ...buildPortalPatch(),
  });

  const handleSave = () => onSave?.(buildPatch());

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label="Status"
        value={status}
        onValueChange={(value: string) => setStatus(value as MarkerStatus)}
      >
        {STATUS_OPTIONS[kind].map(option => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectField>
      <div className="space-y-1.5">
        <p className="type-ui text-heading">Title</p>
        <CompactRichTextEditor
          content={title}
          onChange={setTitle}
          placeholder="Marker title…"
          minHeight="44px"
          ariaLabel="Title"
        />
      </div>
      <div className="space-y-1.5">
        <p className="type-ui text-heading">Body</p>
        <CompactRichTextEditor
          content={body}
          onChange={setBody}
          placeholder="What players can learn…"
          ariaLabel="Body"
        />
      </div>
      <div className="space-y-1.5">
        <p className="type-ui text-heading">
          DM notes — never shown to players
        </p>
        <CompactRichTextEditor
          content={dmNotes}
          onChange={setDmNotes}
          placeholder="Private notes…"
          ariaLabel="DM notes — never shown to players"
        />
      </div>
      {(kind === 'trap' || kind === 'secret') && (
        <Section
          heading="Discovery"
          level={4}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <NumberInput
            id="marker-discovery-dc"
            label="Discovery DC"
            min={0}
            max={40}
            allowEmpty
            value={discoveryDc}
            onChange={setDiscoveryDc}
          />
          <SelectField
            label="Discovery skill"
            value={discoverySkill}
            onValueChange={(value: string) =>
              setDiscoverySkill(value as MarkerDiscoverySkill)
            }
          >
            <SelectItem value="perception">Perception</SelectItem>
            <SelectItem value="investigation">Investigation</SelectItem>
          </SelectField>
        </Section>
      )}
      {kind === 'trap' && (
        <Section
          heading="Trap mechanics"
          level={4}
          contentClassName="grid gap-3 sm:grid-cols-2"
        >
          <NumberInput
            id="marker-disarm-dc"
            label="Disarm DC"
            min={0}
            max={40}
            allowEmpty
            value={disarmDc}
            onChange={setDisarmDc}
          />
          <SelectField
            label="Disarm method"
            value={disarmMethod}
            onValueChange={(value: string) =>
              setDisarmMethod(value as MarkerDisarmMethod)
            }
          >
            <SelectItem value="thieves-tools">Thieves&apos; Tools</SelectItem>
            <SelectItem value="sleight-of-hand">Sleight of Hand</SelectItem>
            <SelectItem value="arcana">Arcana</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectField>
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
        </Section>
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
          access={lootAccess}
          onAccessChange={next => {
            setLootAccess(next);
            onPersist?.(buildPatch(loot, next));
          }}
        />
      )}
      {portalState && (
        <Section
          heading="Destination"
          level={4}
          contentClassName="space-y-3"
          data-testid="portal-destination-section"
        >
          <SelectField
            label="Destination type"
            value={portalDraftKind}
            onValueChange={(value: string) => {
              setPortalTouched(true);
              setPortalDraftKind(value as 'none' | 'battlemap' | 'location');
              setPortalDraftId('');
            }}
            triggerProps={{ 'aria-label': 'Destination type' }}
          >
            <SelectItem value="none">No destination</SelectItem>
            <SelectItem value="battlemap">Battle map</SelectItem>
            <SelectItem value="location">Campaign location</SelectItem>
          </SelectField>

          {portalDraftKind !== 'none' && (
            <SelectField
              label={
                portalDraftKind === 'battlemap'
                  ? 'Target battle map'
                  : 'Target location'
              }
              value={portalDraftId}
              onValueChange={(value: string) => {
                setPortalTouched(true);
                setPortalDraftId(value);
              }}
              triggerProps={{
                'aria-label':
                  portalDraftKind === 'battlemap'
                    ? 'Target battle map'
                    : 'Target location',
              }}
            >
              {(portalDraftKind === 'battlemap'
                ? portalState.battleMapChoices
                : portalState.locationChoices
              ).map(choice => (
                <SelectItem key={choice.id} value={choice.id}>
                  {choice.name}
                </SelectItem>
              ))}
            </SelectField>
          )}

          {portalState.resolved?.status === 'ready' && (
            <div className="flex items-center gap-2">
              {portalState.target?.kind === 'battlemap' ? (
                <Map className="text-muted size-4 shrink-0" />
              ) : (
                <MapPin className="text-muted size-4 shrink-0" />
              )}
              <span className="type-ui text-body">
                {portalState.resolved.name}
              </span>
            </div>
          )}

          {portalState.resolved?.status === 'ready' && (
            <Button variant="secondary" size="sm" asChild>
              <Link href={portalState.resolved.href}>
                Open destination
                <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          )}

          {portalState.resolved?.status === 'missing' && (
            <p className="type-small text-muted">Destination unavailable</p>
          )}

          {portalState.resolved &&
            (portalState.resolved.status === 'invalid' ||
              portalState.resolved.status === 'unsupported') && (
              <p className="type-small text-ember-text">
                Destination cannot be resolved. Edit to replace or remove it.
              </p>
            )}

          {portalState.resolved?.status === 'self' && (
            <p className="type-small text-muted">
              Points to this map (self-link)
            </p>
          )}
        </Section>
      )}
      <DialogFooter>
        <Button variant="danger" onClick={onDelete}>
          Delete
        </Button>
        <Button variant="primary" onClick={handleSave}>
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
  lootLocked,
  onClaimLoot,
}: {
  title: string;
  body: string;
  status?: MarkerStatus;
  loot?: PublicMarkerLootEntry[];
  lootLocked?: boolean;
  onClaimLoot?: (entryId: string, quantity: number) => Promise<number>;
}) {
  const [claimingEntryId, setClaimingEntryId] = useState<string | null>(null);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const handleClaim = async (entryId: string, quantity: number) => {
    if (!onClaimLoot || claimingEntryId) return;
    setClaimingEntryId(entryId);
    setClaimMessage(null);
    try {
      const granted = await onClaimLoot(entryId, quantity);
      setClaimMessage(
        granted < quantity
          ? `Claimed ${granted} of ${quantity} — the rest were already taken. The item will appear on your character shortly.`
          : 'Claimed. The item will appear on your character shortly.'
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
          'type-subheading text-heading',
          MARKER_PANEL_CONTAINMENT_CLASS
        )}
      >
        <MarkerRichText content={title} />
      </div>
      {status && (
        <p className="type-ui text-body">Status: {statusLabel(status)}</p>
      )}
      <div
        data-testid="marker-panel-body"
        className={cn('type-ui text-body', MARKER_PANEL_CONTAINMENT_CLASS)}
      >
        <MarkerRichText content={body} />
      </div>
      {lootLocked && (
        <div className="flex items-center gap-3">
          <Lock size={20} aria-hidden className="text-muted shrink-0" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="type-ui text-heading">Locked</span>
            <span className="type-small text-body">
              You&apos;d need to get it open first.
            </span>
          </span>
        </div>
      )}
      {!lootLocked && loot && loot.length > 0 && (
        <Section
          heading="Loot"
          level={4}
          trailing={<Badge variant="success">Open</Badge>}
        >
          <ul className="divide-divider divide-y">
            {loot.map(entry => {
              const max = Math.max(1, entry.remainingQuantity);
              const requested = Math.min(max, quantities[entry.id] ?? max);
              const soldOut = entry.remainingQuantity <= 0;
              return (
                <li
                  key={entry.id}
                  className="flex flex-col gap-2 py-2 pointer-coarse:min-h-11"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="type-ui text-heading">{entry.name}</span>
                      {entry.rarity && (
                        <Badge variant="neutral">{entry.rarity}</Badge>
                      )}
                    </span>
                    <span className="type-small text-body">
                      {entry.remainingQuantity} available
                    </span>
                  </span>
                  {onClaimLoot && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Take fewer ${entry.name}`}
                          className="w-9 shrink-0 px-0"
                          disabled={soldOut || requested <= 1}
                          onClick={() =>
                            setQuantities(prev => ({
                              ...prev,
                              [entry.id]: Math.max(1, requested - 1),
                            }))
                          }
                        >
                          <Minus size={16} />
                        </Button>
                        <span className="type-num-md text-heading min-w-8.5 text-center tabular-nums">
                          {soldOut ? 0 : requested}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={`Take more ${entry.name}`}
                          className="w-9 shrink-0 px-0"
                          disabled={soldOut || requested >= max}
                          onClick={() =>
                            setQuantities(prev => ({
                              ...prev,
                              [entry.id]: Math.min(max, requested + 1),
                            }))
                          }
                        >
                          <Plus size={16} />
                        </Button>
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        disabled={soldOut || claimingEntryId !== null}
                        onClick={() => void handleClaim(entry.id, requested)}
                      >
                        {claimingEntryId === entry.id
                          ? 'Claiming…'
                          : soldOut
                            ? 'Taken'
                            : `Claim ${requested}`}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="type-small text-muted mt-2">
            Claimed items arrive on your character sheet a moment later.
          </p>
        </Section>
      )}
      {claimMessage && (
        <p role="status" className="type-ui text-body">
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
    return state.data.label ?? MARKER_KIND_LABELS[state.data.kind];
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
  onClaimLoot: MarkerDetailPanelProps['onClaimLoot'],
  portalState: MarkerDetailPanelProps['portalState']
) {
  if (state.kind === 'ready') {
    if (mode === 'dm') {
      return (
        <>
          {(state.data.kind === 'trap' || state.data.kind === 'secret') &&
            isDmOnly !== undefined && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="type-ui text-heading">
                    {isDmOnly ? 'Hidden from players' : 'Discovered'}
                  </p>
                  <p className="type-small text-muted">
                    Visibility applies to every pin linked to this marker.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => onAudienceChange?.(!isDmOnly)}
                  leftIcon={isDmOnly ? <Eye size={16} /> : <EyeOff size={16} />}
                >
                  {isDmOnly ? 'Reveal to players' : 'Hide from players'}
                </Button>
                {audienceNotice && (
                  <p role="alert" className="type-small text-ember-text w-full">
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
            initialLootAccess={
              'lootAccess' in state.detail ? state.detail.lootAccess : undefined
            }
            portalState={portalState}
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
        lootLocked={
          'lootLocked' in state.detail ? state.detail.lootLocked : undefined
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
      const name = state.data.label ?? MARKER_KIND_LABELS[state.data.kind];
      return (
        <p
          data-testid="marker-panel-state-missing-detail"
          className="type-ui text-body"
        >
          Not published yet — the DM hasn&apos;t shared details for this &quot;
          {name}&quot; marker.
        </p>
      );
    }
    return (
      <div data-testid="marker-panel-state-missing-detail">
        <p className="type-ui text-body mb-3">
          This pin doesn&apos;t have details yet — add them below.
        </p>
        <EditForm
          key={state.data.ref}
          kind={state.data.kind}
          initialTitle=""
          initialBody=""
          initialDmNotes=""
          portalState={portalState}
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
    const name = state.data.label ?? MARKER_KIND_LABELS[state.data.kind];
    return (
      <p
        data-testid="marker-panel-state-unpublished"
        className="type-ui text-body"
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
        className="type-ui text-body"
      >
        This marker&apos;s data could not be read and cannot be displayed.
      </p>
    );
  }

  return (
    <p
      data-testid="marker-panel-state-unsupported-version"
      className="type-ui text-body"
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
  portalState,
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
            <span className="inline-flex items-center gap-2">
              {KindIcon && (
                <KindIcon
                  aria-hidden="true"
                  className="text-muted size-5 shrink-0"
                />
              )}
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
            onClaimLoot,
            portalState
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
