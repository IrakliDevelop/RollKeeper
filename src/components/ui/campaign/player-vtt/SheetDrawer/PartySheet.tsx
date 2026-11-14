'use client';

import { Eye, X } from 'lucide-react';

import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { Button } from '@/components/ui/forms/button';

import { ConditionCard, GearCard, StatsCard } from './PartySheetCards';

export interface PartySheetProps {
  member: PartyMemberHP | undefined;
  onClose: () => void;
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClose}
      className="w-9 px-0"
      aria-label="Close sheet"
    >
      <X size={16} aria-hidden="true" />
    </Button>
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
          <p className="type-body text-muted">
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
        <div className="size-12 shrink-0 self-start">
          {member.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.avatar}
              alt=""
              className="size-12 rounded-full object-cover"
            />
          ) : (
            <div className="bg-surface-raised type-subheading text-heading flex size-12 items-center justify-center rounded-full">
              {initial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="type-heading text-heading truncate">
            {member.characterName}
          </h2>
          <p className="type-small text-muted truncate">{subtitle}</p>
          <p className="type-small text-muted mt-1.5 flex items-center gap-1">
            <Eye size={14} aria-hidden="true" />
            Limited view · played by {member.playerName}
          </p>
        </div>
        <div className="shrink-0">
          <CloseButton onClose={onClose} />
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {publicSheet === null ? (
          <p className="type-body text-muted">
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
            <p className="type-small text-muted">
              {member.playerName} controls this sheet. This view shows only what
              they share with the party.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
