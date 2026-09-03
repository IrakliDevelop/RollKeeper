/**
 * Types for the marker detail panel: the resolver's state machine and the
 * component's props. See `MarkerDetailPanel.utils.ts` for the resolver and
 * `index.tsx` for the component that renders these states.
 */
import type {
  MarkerDetail,
  PublicMarkerDetail,
  MarkerDiscovery,
  MarkerStatus,
  MarkerTrapMechanics,
  MarkerLootEntry,
  MarkerPortalTargetV1,
} from '@/types/battlemap';

import type { PortalDestinationResult } from '../markerPortal';

import type { MarkerElementDataV1 } from '../markerData';

/** A selectable target for the destination picker. */
export interface PortalTargetChoice {
  id: string;
  name: string;
}

/** Resolved portal state passed into the panel from the surface. */
export interface ResolvedPortalState {
  /** The raw persisted target, if any. */
  target?: MarkerPortalTargetV1;
  /** Resolved destination for display. Computed by the surface from live stores. */
  resolved?: PortalDestinationResult;
  /** Available battle maps (excluding self if source is a battle map). */
  battleMapChoices: PortalTargetChoice[];
  /** Available campaign locations (excluding self if source is a location). */
  locationChoices: PortalTargetChoice[];
}

export type MarkerPanelMode = 'dm' | 'player';

export type MarkerPanelState =
  | {
      kind: 'ready';
      data: MarkerElementDataV1;
      detail: MarkerDetail | PublicMarkerDetail;
    }
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
  campaignCode?: string;
  dmId?: string;
  onClose: () => void;
  /** DM mode only. Portal destination state resolved by the surface. */
  portalState?: ResolvedPortalState;
  /** DM mode only. */
  onSave?: (patch: {
    title: string;
    body: string;
    dmNotes: string;
    status: MarkerStatus;
    discovery?: MarkerDiscovery;
    trap?: MarkerTrapMechanics;
    loot?: MarkerLootEntry[];
    portal?: MarkerPortalTargetV1 | null;
  }) => void;
  /** DM mode only. Background persistence that must not close the dialog. */
  onPersist?: MarkerDetailPanelProps['onSave'];
  /** DM mode only. */
  onDelete?: () => void;
  /** DM mode only. The value is the current audience of the active pin. */
  isDmOnly?: boolean;
  /** DM mode only. Applies to every sibling pin sharing this marker ref. */
  onAudienceChange?: (dmOnly: boolean) => void;
  audienceNotice?: string | null;
  /** Player mode only. Claims one unit from an authoritative server ledger. */
  onClaimLoot?: (entryId: string) => Promise<void>;
}
