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
      className="text-body flex min-h-[44px] items-center gap-2 px-1 text-sm"
    >
      <Icon size={14} className="text-muted shrink-0" />
      {/* Untrusted wire text: React text node only. */}
      <span className="flex-1 truncate">{peer.name || peer.id}</span>
      {peer.hasCursor && (
        <MousePointer2
          size={12}
          className="text-muted shrink-0"
          aria-label="Cursor visible"
        />
      )}
      {!peer.verified && (
        <span className="text-muted shrink-0 text-xs">unverified</span>
      )}
    </li>
  );
}
