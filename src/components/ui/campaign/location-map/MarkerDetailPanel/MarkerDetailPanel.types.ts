/**
 * Types for the marker detail panel: the resolver's state machine and the
 * component's props. See `MarkerDetailPanel.utils.ts` for the resolver and
 * `index.tsx` for the component that renders these states.
 */
import type {
  MarkerDetail,
  MarkerDiscovery,
  MarkerStatus,
  MarkerTrapMechanics,
} from '@/types/battlemap';

import type { MarkerElementDataV1 } from '../markerData';

export type MarkerPanelMode = 'dm' | 'player';

export type MarkerPanelState =
  | { kind: 'ready'; data: MarkerElementDataV1; detail: MarkerDetail }
  /** DM only: the pin is valid but its detail record is gone (an orphan pin). */
  | { kind: 'missing-detail'; data: MarkerElementDataV1 }
  /** Player only: the marker is shared but the DM has not pushed details yet
   * (spec §6.6). */
  | { kind: 'unpublished'; data: MarkerElementDataV1 }
  | { kind: 'invalid-data'; reason: string }
  | { kind: 'unsupported-version'; version?: number };

export interface MarkerDetailPanelProps {
  open: boolean;
  mode: MarkerPanelMode;
  state: MarkerPanelState;
  onClose: () => void;
  /** DM mode only. */
  onSave?: (patch: {
    title: string;
    body: string;
    dmNotes: string;
    status: MarkerStatus;
    discovery?: MarkerDiscovery;
    trap?: MarkerTrapMechanics;
  }) => void;
  /** DM mode only. */
  onDelete?: () => void;
  /** DM mode only. The value is the current audience of the active pin. */
  isDmOnly?: boolean;
  /** DM mode only. Applies to every sibling pin sharing this marker ref. */
  onAudienceChange?: (dmOnly: boolean) => void;
  audienceNotice?: string | null;
}
