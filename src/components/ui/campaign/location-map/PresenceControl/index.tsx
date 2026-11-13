'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Users } from 'lucide-react';
import type { PeerRoster } from '@fieldnotes/core';

import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';

import { summarizePeers } from '../awarenessPeers';
import { useAwarenessPeers } from '../useAwarenessPeers';
import { usePlayerDirectory } from '../usePlayerDirectory';
import { PeerRow } from './PeerRow';

export interface PresenceControlProps {
  campaignCode: string;
  roster: PeerRoster | null;
  cursorSharing: boolean;
  onCursorSharingChange: (enabled: boolean) => void;
  showPlayerCursors: boolean;
  onShowPlayerCursorsChange: (enabled: boolean) => void;
}

/**
 * DM popover: who is viewing this map (live SDK roster, deduped by app id,
 * player rows cross-checked against the DM-only /players directory) plus
 * the two session switches — "Share my cursor" (publish, default OFF) and
 * "Show player cursors" (render players' cursors, default ON; other DMs'
 * cursors are unaffected). Names are self-asserted wire text and render as
 * text nodes only.
 */
export function PresenceControl({
  campaignCode,
  roster,
  cursorSharing,
  onCursorSharingChange,
  showPlayerCursors,
  onShowPlayerCursorsChange,
}: PresenceControlProps) {
  const peers = useAwarenessPeers(roster);
  const { directory, ensureKnown } = usePlayerDirectory(campaignCode, true);
  const rows = useMemo(
    () => summarizePeers(peers, directory?.ids ?? null),
    [peers, directory]
  );
  useEffect(() => {
    ensureKnown(rows.filter(r => r.role === 'player').map(r => r.id));
  }, [rows, ensureKnown]);
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          selected={open}
          leftIcon={<Users size={16} aria-hidden />}
          rightIcon={<ChevronDown size={14} aria-hidden />}
        >
          {`Viewers · ${rows.length}`}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          aria-label="Viewers"
          data-testid="presence-popover"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={`${OVERLAY_SURFACE} z-[60] w-72 max-w-[calc(100vw-1rem)] p-3`}
        >
          {rows.length === 0 ? (
            <p className="text-muted px-1 text-sm">
              No one else is viewing this map.
            </p>
          ) : (
            <ul className="flex flex-col">
              {rows.map(peer => (
                <PeerRow key={peer.id} peer={peer} />
              ))}
            </ul>
          )}
          <div className="border-divider my-2 border-t" />
          <Switch
            checked={cursorSharing}
            onCheckedChange={onCursorSharingChange}
            aria-label="Share my cursor"
            label="Share my cursor"
            description="Players and the TV display see your pointer. Off by default each session."
          />
          <div className="mt-2">
            <Switch
              checked={showPlayerCursors}
              onCheckedChange={onShowPlayerCursorsChange}
              aria-label="Show player cursors"
              label="Show player cursors"
              description="Draw players' pointers on this map. Other DMs' pointers always show."
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default PresenceControl;
