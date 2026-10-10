import type { TableCombatResult } from '@/lib/table/combat';
import type { PublicationStatus } from '@/lib/table/combatPublisher';

const REJECTIONS: Record<string, string> = {
  'active-run': 'Another run is active. End it before starting this one.',
  'run-active': 'This run is already running.',
  'not-active': 'This run is not running here.',
  'imported-active':
    'This run was imported as active and is not running here. Reset its imported state first.',
  'initiative-required': 'A running participant needs an initiative value.',
  'no-participants': 'Choose at least one participant first.',
  'participant-limit': 'A run can have at most 256 participants.',
  'member-removed': 'A chosen participant was removed from this scene.',
  'read-only': 'That participant is view only here.',
  'archive-capacity':
    'Combat history is full. Export or delete an old archive in History to start a new fight.',
  'archive-active': 'The running combat’s archive cannot be deleted.',
  'invalid-reference':
    'The table data on this device no longer matches this action. If this keeps happening, export your tables from Battle Maps.',
  'limit-exceeded': 'This table is full on this device. Nothing was saved.',
};

/** Visible message for a failed combat command (nothing was saved). */
export function combatFailureMessage(result: TableCombatResult): string {
  if (result.status === 'conflict')
    return 'Changed in another tab or device. Check it and try again.';
  if (result.status === 'rejected') {
    if (result.reason === 'missing-initiative')
      return 'Enter every initiative (0 is valid) before starting.';
    return REJECTIONS[result.reason] ?? 'The change was rejected.';
  }
  if (result.status === 'failed') {
    if (result.reason === 'indexeddb-unavailable')
      return 'Table storage is unavailable on this device. Nothing was saved.';
    if (result.reason === 'quota-exceeded')
      return 'Device storage is full. Nothing was saved.';
    return 'Saving failed. Nothing was changed.';
  }
  return 'The change was not saved.';
}

/** D8 status wording. */
export function publicationLabel(
  status: PublicationStatus,
  liveUnavailable: boolean
): string {
  if (liveUnavailable) return 'Live play unavailable';
  switch (status.kind) {
    case 'saved-locally':
      return 'Saved locally';
    case 'broadcasting':
      return 'Initiative shared with players';
    case 'publishing':
      return 'Sharing…';
    case 'cleared':
      return "Players' initiative was cleared. Share it again.";
    case 'not-broadcasting':
      if (status.pending === 'publish')
        return 'Started here, not shared with players';
      return 'Not shared with players';
    case 'stale':
      return "Players' initiative may be out of date";
    case 'waiting':
      return 'Waiting for player data';
    case 'blocked':
      return status.reason === 'too-large'
        ? 'Initiative list is too big to share with players'
        : "Can't share: a player link is invalid";
  }
}

/** O7-3: a raw reason behind "Not shared with players" (tooltip only). */
export function publicationDetail(
  status: PublicationStatus,
  liveUnavailable: boolean
): string | undefined {
  if (liveUnavailable || status.kind !== 'not-broadcasting') return undefined;
  if (status.pending === 'publish') return undefined;
  return status.reason === 'no-control' || status.reason === 'lease-lost'
    ? undefined
    : status.reason;
}
