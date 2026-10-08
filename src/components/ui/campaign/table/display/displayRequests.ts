import type { SideChannelRequest } from '../sideChannelRequests';

/**
 * PR05 wire shapes for the campaign display (Q4/C4-2 style): the launcher,
 * the display shell, the DM status poll and the route tests all build their
 * requests here, so a client/server mismatch fails a test. Secrets travel
 * only in POST bodies; nothing here ever puts a capability in a URL.
 */
export interface DisplayCredential {
  capability: string;
  nonce: string;
}

/**
 * PR07 M1: the display's self-report of its S5 scale state (optional ACK
 * key; absent = unknown). Device-reported, grants nothing.
 */
export const DISPLAY_CALIBRATION_REPORTS = [
  'uncalibrated',
  'verified',
  'verify-required',
  'unsupported',
] as const;
export type DisplayCalibrationReport =
  (typeof DISPLAY_CALIBRATION_REPORTS)[number];

export interface DisplayAck {
  displayGeneration: number;
  epoch: string;
  presentationRevision: number;
  sceneId: string | null;
  blanked: boolean;
  phase: 'loaded' | 'blank';
  calibration?: DisplayCalibrationReport;
}

export interface DisplayDescriptor {
  displayGeneration: number;
  epoch: string;
  presentation: { sceneId: string | null; revision: number; blanked: boolean };
  scene: { sceneId: string; sourceMapId: string; label: string } | null;
}

export type DisplayStatusState =
  | 'none'
  | 'loaded'
  | 'blank'
  | 'waiting'
  | 'updating'
  | 'stale';

export interface DisplayStatus {
  state: DisplayStatusState;
  sceneId: string | null;
  ageMs: number | null;
  /** Fresh matching loaded/blank/waiting records only (PR07 M1). */
  calibration?: DisplayCalibrationReport;
}

const MUTATION_HEADERS = {
  'Content-Type': 'application/json',
  'x-rollkeeper-csrf': '1',
} as const;

const displayBase = (code: string) =>
  `/api/campaign/${encodeURIComponent(code)}/table/display`;

const post = (url: string, body: unknown): SideChannelRequest => ({
  url,
  init: {
    method: 'POST',
    headers: { ...MUTATION_HEADERS },
    body: JSON.stringify(body),
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
  },
});

/** E3: Open display (rotation) by a campaign DM. */
export const displayCapabilityRequest = (
  code: string,
  dmId: string
): SideChannelRequest => post(`${displayBase(code)}/capability`, { dmId });

/** E6: the display's descriptor read (binds the nonce on first use). */
export const displayDescriptorRequest = (
  code: string,
  credential: DisplayCredential
): SideChannelRequest =>
  post(`${displayBase(code)}/descriptor`, {
    capability: credential.capability,
    nonce: credential.nonce,
  });

/** E7: ACK/heartbeat for the exact rendered tuple. */
export const displayAckRequest = (
  code: string,
  credential: DisplayCredential,
  ack: DisplayAck
): SideChannelRequest =>
  post(`${displayBase(code)}/ack`, {
    capability: credential.capability,
    nonce: credential.nonce,
    ack,
  });

/** E13: DM display status (no secrets in the URL or the answer). */
export const displayStatusUrl = (code: string, dmId: string): string =>
  `${displayBase(code)}/status?dmId=${encodeURIComponent(dmId)}`;

/** Table v1 off: the legacy map-pinned display key mint (E3). */
export const legacyDisplayKeyRequest = (
  code: string,
  dmId: string
): SideChannelRequest => ({
  url: `/api/campaign/${encodeURIComponent(code)}/display-key`,
  init: {
    method: 'POST',
    headers: { ...MUTATION_HEADERS },
    body: JSON.stringify({ dmId }),
  },
});
