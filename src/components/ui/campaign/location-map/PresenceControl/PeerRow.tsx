import { Monitor, MousePointer2, Crown, User } from 'lucide-react';

import type { PeerSummary } from '../awarenessPeers';

const ROLE_ICON = {
  dm: Crown,
  player: User,
  display: Monitor,
  unknown: User,
} as const;

export function PeerRow({ peer }: { peer: PeerSummary }) {
  const Icon = ROLE_ICON[peer.role];
  return (
    <li
      data-testid="presence-peer-row"
      className="text-body flex items-center gap-2 px-1 py-1.5 text-sm"
    >
      <Icon size={14} aria-hidden className="text-muted shrink-0" />
      {/* Untrusted wire text: React text node only. */}
      <span className="flex-1 truncate">{peer.name || peer.id}</span>
      {peer.hasCursor && (
        <MousePointer2
          size={12}
          role="img"
          aria-label="Cursor visible"
          className="text-muted shrink-0"
        />
      )}
      {!peer.verified && (
        <span className="type-small text-muted shrink-0">Unverified</span>
      )}
    </li>
  );
}
