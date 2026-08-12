import {
  DoorClosed,
  Gem,
  KeyRound,
  StickyNote,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import type { MarkerKind } from './markerData';

/** One recognizable Lucide icon for every marker kind. This is shared by the
 * picker and detail panel so the visual language cannot drift between them. */
export const MARKER_KIND_ICONS: Readonly<Record<MarkerKind, LucideIcon>> = {
  door: DoorClosed,
  trap: TriangleAlert,
  loot: Gem,
  npc: UserRound,
  secret: KeyRound,
  note: StickyNote,
};
