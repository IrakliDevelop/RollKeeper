'use client';

import { Eye, Shield, X, Zap } from 'lucide-react';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { getHpTierBarColor } from '@/utils/hpColor';
import { hpPercent, hpTier } from '@/utils/hpState';

import { HEADING_CLASS, SECTION_CLASS } from './sheetSectionStyles';

export interface PartySheetProps {
  member: PartyMemberHP | undefined;
  onClose: () => void;
}

const TILE_CLASS =
  'border-divider bg-surface rounded-lg border p-2 text-center';
const VALUE_CLASS = 'text-heading text-xl font-bold';
const LABEL_CLASS = 'text-faint text-xs uppercase';

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClose}
      aria-label="Close sheet"
      title="Close (Esc)"
    >
      <X className="h-4 w-4" />
    </Button>
  );
}

function ConditionCard({
  member,
  hpState,
  concentration,
  conditions,
}: {
  member: PartyMemberHP;
  hpState: string;
  concentration: string | null;
  conditions: string[];
}) {
  const hp = member.hitPoints;
  return (
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Condition</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-heading text-lg font-bold">
          {hpState || 'Unknown'}
        </span>
        {hp && (
          <span className="text-muted text-xs">
            {hp.current}/{hp.max}
          </span>
        )}
      </div>
      {hp && (
        <div className="bg-surface-secondary mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={`h-full rounded-full ${getHpTierBarColor(hpTier(hpPercent(hp.current, hp.max)))}`}
            style={{ width: `${hpPercent(hp.current, hp.max)}%` }}
          />
        </div>
      )}
      {(concentration || conditions.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {concentration && (
            <Badge variant="info">
              <Zap className="mr-1 h-3 w-3" />
              {concentration}
            </Badge>
          )}
          {conditions.map(name => (
            <Badge key={name} variant="danger">
              {name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsCard({
  armorClass,
  speed,
  passivePerception,
}: {
  armorClass: number;
  speed: number;
  passivePerception: number;
}) {
  return (
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Stats</h3>
      <div className="grid grid-cols-3 gap-2">
        <div className={TILE_CLASS}>
          <div
            className={`${VALUE_CLASS} flex items-center justify-center gap-1`}
          >
            <Shield className="h-4 w-4" />
            {armorClass}
          </div>
          <div className={LABEL_CLASS}>AC</div>
        </div>
        <div className={TILE_CLASS}>
          <div className={VALUE_CLASS}>{speed} ft</div>
          <div className={LABEL_CLASS}>Speed</div>
        </div>
        <div className={TILE_CLASS}>
          <div className={VALUE_CLASS}>{passivePerception}</div>
          <div className={LABEL_CLASS}>Passive Perception</div>
        </div>
      </div>
    </div>
  );
}

function GearCard({ equippedGear }: { equippedGear: string[] }) {
  return (
    <div className={SECTION_CLASS}>
      <h3 className={HEADING_CLASS}>Equipped, visible to the party</h3>
      {equippedGear.length === 0 ? (
        <p className="text-muted text-sm">Nothing equipped.</p>
      ) : (
        <ul className="text-body space-y-1 text-sm">
          {equippedGear.map(name => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Read-only "limited view" of another party member's sheet, shown in the map
 * character-sheet drawer. Renders `PartyMemberHP.publicSheet` — never the
 * full character — so it stays in lockstep with whatever privacy rules
 * `buildPartyPublicSheet` (src/utils/partyPublicSheet.ts) enforces server-side.
 */
export function PartySheet({ member, onClose }: PartySheetProps) {
  if (!member) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-divider flex items-center justify-between gap-3 border-b px-5 py-4">
          <p className="text-muted text-sm">
            This character isn&apos;t in the party list yet.
          </p>
          <CloseButton onClose={onClose} />
        </div>
      </div>
    );
  }

  // Older servers mid-deploy may omit `publicSheet` entirely — treat it the
  // same as an explicit opt-out (null).
  const publicSheet = member.publicSheet ?? null;
  const initial = member.characterName.charAt(0).toUpperCase() || '?';
  const subtitle =
    publicSheet?.subtitle ?? `${member.className} ${member.level}`;

  return (
    <div className="flex h-full flex-col">
      <div className="border-divider flex gap-3 border-b px-5 pt-4 pb-3">
        <div className="h-14 w-14 shrink-0 self-start">
          {member.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatar}
              alt=""
              className="h-14 w-14 rounded-xl object-cover"
            />
          ) : (
            <div className="bg-accent-blue-bg text-accent-blue-text flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-heading truncate text-xl font-bold">
            {member.characterName}
          </h2>
          <p className="text-muted truncate text-xs">{subtitle}</p>
          <p className="text-faint mt-1.5 flex items-center gap-1 text-xs">
            <Eye className="h-3 w-3" />
            Limited view · played by {member.playerName}
          </p>
        </div>
        <div className="shrink-0">
          <CloseButton onClose={onClose} />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {publicSheet === null ? (
          <p className="text-muted text-sm">
            {member.characterName} hasn&apos;t shared their sheet.
          </p>
        ) : (
          <>
            <ConditionCard
              member={member}
              hpState={publicSheet.hpState}
              concentration={publicSheet.concentration}
              conditions={publicSheet.conditions}
            />
            <StatsCard
              armorClass={member.armorClass}
              speed={publicSheet.speed}
              passivePerception={publicSheet.passivePerception}
            />
            <GearCard equippedGear={publicSheet.equippedGear} />
            <p className="text-faint text-xs">
              {member.playerName} controls this sheet. Exact HP (unless shared),
              spell slots, inventory and notes stay private.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
