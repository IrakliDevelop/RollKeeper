'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { UserX } from 'lucide-react';
import { ImageLightbox } from '@/components/ui/feedback/ImageLightbox';
import { Button } from '@/components/ui/forms/button';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import { Badge } from '@/components/ui/layout/badge';
import { CounterStepper } from './CounterStepper';
import { HpReadout } from './HpReadout';
import {
  calculateCharacterArmorClass,
  calculatePassiveInsight,
  calculatePassiveInvestigation,
  calculatePassivePerception,
} from '@/utils/calculations';
import type { CampaignPlayerData } from '@/types/campaign';
import type { ActiveCondition } from '@/types/character';

/** The one name for a player's character: heading, labels and confirms. */
export function playerDisplayName(player: CampaignPlayerData): string {
  return player.characterData.name || player.characterName || 'Character';
}

export interface PlayerRosterRowProps {
  player: CampaignPlayerData;
  customCounterLabel?: string;
  counterValue?: number;
  onAdjustCounter?: (delta: number) => void;
  onView: () => void;
  onRemove?: () => void;
}

function ensureArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** "Synced just now" / "Last synced 3 min ago"; null for an unreadable time. */
function syncFreshness(lastSynced: string, now = Date.now()) {
  const s = (now - new Date(lastSynced).getTime()) / 1000;
  if (!Number.isFinite(s)) return null;
  const text =
    s < 60
      ? 'Synced just now'
      : s < 3600
        ? `Last synced ${Math.floor(s / 60)} min ago`
        : `Last synced ${Math.floor(s / 3600)} h ago`;
  return { text, stale: s >= 120 };
}

function RowAvatar({ src, name }: { src?: string; name: string }) {
  const [open, setOpen] = useState(false);
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className="hidden size-10 shrink-0 sm:block pointer-coarse:size-11"
      />
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label={`View ${name} image full size`}
        onClick={() => setOpen(true)}
        className="border-divider relative size-10 shrink-0 overflow-hidden rounded-md border pointer-coarse:size-11"
      >
        <Image
          src={src}
          alt=""
          fill
          sizes="44px"
          className="object-cover"
          unoptimized={src.startsWith('data:')}
        />
      </button>
      {open && (
        <ImageLightbox src={src} alt={name} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function StatusChips({
  concentration,
  conditions,
}: {
  concentration?: string;
  conditions: ActiveCondition[];
}) {
  if (!concentration && conditions.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {concentration && (
        <li key="concentration">
          <ConditionChip
            kind="concentration"
            name={`Concentrating on ${concentration}`}
          />
        </li>
      )}
      {conditions.map(c => (
        <li key={c.id || c.name}>
          <ConditionChip name={c.name} stackCount={c.count} />
        </li>
      ))}
    </ul>
  );
}

/** One character on the DM's campaign roster. */
export function PlayerRosterRow({
  player,
  customCounterLabel,
  counterValue = 0,
  onAdjustCounter,
  onView,
  onRemove,
}: PlayerRosterRowProps) {
  const headingId = useId();
  const char = player.characterData;
  const name = playerDisplayName(player);
  const cls = char.class?.name;
  const level = char.totalLevel || char.level || 1;
  const meta = [char.race, cls ? `${cls} ${level}` : `Level ${level}`]
    .filter(Boolean)
    .join(' ');
  const sync = syncFreshness(player.lastSynced);
  const inspiration = char.heroicInspiration?.count ?? 0;

  return (
    <li
      data-testid={`player-row-${player.playerId}`}
      className="flex gap-3 py-4 pointer-coarse:min-h-11"
    >
      <RowAvatar src={char.avatar?.trim()} name={name} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0 flex-[1_1_14rem]">
            <h3
              id={headingId}
              className="type-label-heading text-heading break-words"
            >
              {name}
            </h3>
            <p className="type-small text-muted">
              <span>
                {meta} · {player.playerName}
              </span>
              {sync && (
                <>
                  {' · '}
                  <span
                    className={sync.stale ? 'text-ember-text' : 'text-muted'}
                  >
                    {sync.text}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" aria-describedby={headingId} onClick={onView}>
              View sheet
            </Button>
            {onRemove && (
              <Button
                variant="danger"
                size="sm"
                className="px-2"
                aria-label={`Remove ${name} from campaign`}
                onClick={onRemove}
              >
                <UserX size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="w-full sm:w-56">
            <HpReadout
              current={char.hitPoints?.current ?? 0}
              max={char.hitPoints?.max ?? 0}
              temp={char.hitPoints?.temporary ?? 0}
              size="sm"
            />
          </div>
          <span className="type-ui text-heading">
            AC{' '}
            <span className="tabular-nums">
              {calculateCharacterArmorClass(char)}
            </span>
          </span>
          <p className="type-small text-muted">
            Passive Perception{' '}
            <span className="text-heading tabular-nums">
              {calculatePassivePerception(char)}
            </span>
            <span className="hidden md:inline">
              {' · Insight '}
              <span className="text-heading tabular-nums">
                {calculatePassiveInsight(char)}
              </span>
              {' · Investigation '}
              <span className="text-heading tabular-nums">
                {calculatePassiveInvestigation(char)}
              </span>
            </span>
          </p>
          {inspiration > 0 && (
            <Badge variant="primary" size="sm">
              {inspiration > 1 ? `Inspiration ×${inspiration}` : 'Inspiration'}
            </Badge>
          )}
          {customCounterLabel && onAdjustCounter && (
            <CounterStepper
              label={customCounterLabel}
              value={counterValue}
              name={name}
              onAdjust={onAdjustCounter}
            />
          )}
        </div>
        <StatusChips
          concentration={
            char.concentration?.isConcentrating
              ? char.concentration.spellName
              : undefined
          }
          conditions={ensureArray<ActiveCondition>(
            char.conditionsAndDiseases?.activeConditions
          )}
        />
      </div>
    </li>
  );
}
