'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Users } from 'lucide-react';
import type { PeerRoster } from '@fieldnotes/core';

import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';

import { summarizePeers } from '../awarenessPeers';
import { useAwarenessPeers } from '../useAwarenessPeers';
import { usePlayerDirectory } from '../usePlayerDirectory';
import { PeerRow } from './PeerRow';
import { usePresencePopover } from './PresenceControl.hooks';

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
  const { open, toggleOpen, rootRef, popoverRef, position } =
    usePresencePopover();

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant={open ? 'primary' : 'ghost'}
        onClick={toggleOpen}
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 px-3 text-xs"
      >
        <Users size={14} />
        {`Viewers · ${rows.length}`}
        <ChevronDown size={14} />
      </Button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            data-testid="presence-popover"
            className="bg-surface-raised border-divider fixed z-50 w-72 rounded-xl border p-3 shadow-xl"
            style={position}
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
          </div>,
          document.body
        )}
    </div>
  );
}

export default PresenceControl;
