import { legacyDisplayKeyRequest } from '@/components/ui/campaign/table/display/displayRequests';
import {
  openTableDisplay,
  type OpenTableDisplayResult,
} from '@/lib/openTableDisplay';

/**
 * The battle-map editor's "Open display". Under Table v1 it opens the
 * persistent campaign display (PR05 E12): the map-pinned plaintext key is
 * retired there. With v1 off it keeps the legacy map-pinned behaviour,
 * now with the CSRF header the display-key route requires (E3).
 */
export async function openTvDisplay(
  campaignCode: string,
  battleMapId: string,
  dmId: string
): Promise<OpenTableDisplayResult | void> {
  if (process.env.NEXT_PUBLIC_TABLE_PROTOCOL_V1_REQUIRED === 'true')
    return openTableDisplay({ code: campaignCode, dmId });

  // Open the tab synchronously, in direct response to the user gesture —
  // Safari (and sometimes Chrome) revokes transient user activation across
  // an `await`, so opening after the fetch below would silently no-op.
  const win = window.open('', '_blank');

  let dk = '';
  try {
    const { url, init } = legacyDisplayKeyRequest(campaignCode, dmId);
    const res = await fetch(url, init);
    if (res.ok) {
      dk = ((await res.json()) as { displayKey?: string }).displayKey ?? '';
    }
  } catch {
    // relay not configured — the display page will show its own error state
  }

  const url = `/dm/campaign/${campaignCode}/battlemaps/${battleMapId}/display${
    dk ? `?dk=${encodeURIComponent(dk)}` : ''
  }`;

  if (win) {
    win.location.href = url;
  } else {
    // Popup blocked despite the synchronous open attempt — fall back to
    // the old behavior so at least some browsers still get a new tab.
    window.open(url, '_blank');
  }
}
