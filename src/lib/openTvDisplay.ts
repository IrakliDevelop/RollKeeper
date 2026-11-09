import {
  openTableDisplay,
  type OpenTableDisplayResult,
} from '@/lib/openTableDisplay';

/**
 * The battle-map editor's "Open display": it opens the persistent campaign
 * display (PR05 E12). The map-pinned plaintext display key is retired.
 */
export async function openTvDisplay(
  campaignCode: string,
  dmId: string
): Promise<OpenTableDisplayResult> {
  return openTableDisplay({ code: campaignCode, dmId });
}
