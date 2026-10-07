import type {
  PresentationCommand,
  TableControlSession,
  TableDescriptor,
} from '@/lib/table/authorityLifecycle';

import type { TableAuthorityState } from '../useTableSceneAuthority';

/** Registry-derived safe labels, keyed by scene id (DM read only). */
export type PresentationLabels = Readonly<
  Record<string, { safeLabel: string; sourceMapId: string | null }>
>;

export interface PresentationMessage {
  tone: 'success' | 'info' | 'error';
  text: string;
  /**
   * `command`: identical resend (P3.4); absent: a deliberate re-intent with
   * a new operation id.
   */
  retry?: { label: 'Retry' | 'Try again'; command?: PresentationCommand };
}

export interface TablePresentationControlsProps {
  campaignCode: string;
  dmId: string;
  /** The route (viewed/prepared) scene. */
  sceneId: string;
  sceneName: string;
  authorityState: TableAuthorityState;
  session: TableControlSession | null;
  /** The page session's latest descriptor (null before preparation). */
  descriptor: TableDescriptor | null;
}
