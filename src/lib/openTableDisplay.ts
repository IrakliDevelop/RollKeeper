import { displayCapabilityRequest } from '@/components/ui/campaign/table/display/displayRequests';

export type OpenTableDisplayFailure =
  | 'popup-blocked'
  | 'not-initialized'
  | 'denied'
  | 'unavailable'
  | 'network';

export type OpenTableDisplayResult =
  | { ok: true }
  | { ok: false; reason: OpenTableDisplayFailure; message: string };

export const OPEN_DISPLAY_MESSAGES: Record<OpenTableDisplayFailure, string> = {
  'popup-blocked':
    'Popup blocked — allow popups for this site and click Open display again',
  'not-initialized': 'Live table is not initialized — open a Table scene first',
  denied: 'Only the campaign DM can open the display',
  unavailable: 'The display could not be opened — try again',
  network: 'The display could not be opened — check your connection',
};

const CAPABILITY = /^[A-Za-z0-9_-]{43}$/u;

const fail = (reason: OpenTableDisplayFailure): OpenTableDisplayResult => ({
  ok: false,
  reason,
  message: OPEN_DISPLAY_MESSAGES[reason],
});

/**
 * PR05 E12 launcher. Call it directly from the click handler: the window
 * is opened synchronously (popup policy) before any await. A blocked popup
 * never rotates, so an existing monitor keeps working. On success the new
 * capability is handed over only in the URL fragment of the opened tab; on
 * any failure that tab is closed. There is no fallback that opens a URL.
 */
export async function openTableDisplay(input: {
  code: string;
  dmId: string;
}): Promise<OpenTableDisplayResult> {
  const win = window.open('about:blank', '_blank');
  if (!win) return fail('popup-blocked');
  try {
    win.opener = null;
  } catch {
    // Some browsers expose a read-only opener; the tab stays same-origin.
  }
  let capability: unknown;
  try {
    const { url, init } = displayCapabilityRequest(input.code, input.dmId);
    const response = await fetch(url, init);
    if (!response.ok) {
      win.close();
      return fail(
        response.status === 409
          ? 'not-initialized'
          : response.status === 403 || response.status === 401
            ? 'denied'
            : 'unavailable'
      );
    }
    capability = ((await response.json()) as { capability?: unknown })
      .capability;
  } catch {
    win.close();
    return fail('network');
  }
  if (typeof capability !== 'string' || !CAPABILITY.test(capability)) {
    win.close();
    return fail('unavailable');
  }
  win.location.replace(
    `/table-display/${encodeURIComponent(input.code)}#k=${capability}`
  );
  return { ok: true };
}
