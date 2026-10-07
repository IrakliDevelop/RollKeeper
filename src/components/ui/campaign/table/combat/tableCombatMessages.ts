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
  'read-only': 'That participant is read-only in scene runs.',
  'archive-capacity':
    'Combat history is full. Export or delete an old archive in History to start a new fight.',
  'archive-active': 'The running combat’s archive cannot be deleted.',
  'invalid-reference':
    'The local Table data no longer matches this action. Export the Table bundle from Battle Maps if this persists.',
  'limit-exceeded':
    'This workspace is at its local size limit. Nothing was saved.',
};

/** Visible message for a failed combat command (nothing was saved). */
export function combatFailureMessage(result: TableCombatResult): string {
  if (result.status === 'conflict')
    return 'Changed elsewhere — review and retry';
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
  if (liveUnavailable) return 'Live publishing unavailable';
  switch (status.kind) {
    case 'saved-locally':
      return 'Saved locally';
    case 'broadcasting':
      return 'Broadcasting initiative';
    case 'publishing':
      return 'Publishing…';
    case 'cleared':
      return 'Public initiative cleared — Publish current state';
    case 'not-broadcasting':
      if (status.pending === 'publish')
        return 'Started locally · not broadcasting';
      return status.reason === 'no-control' || status.reason === 'lease-lost'
        ? 'Not broadcasting'
        : `Not broadcasting (${status.reason})`;
    case 'stale':
      return 'Remote initiative may be stale';
    case 'blocked':
      return status.reason === 'too-large'
        ? 'Initiative too large to broadcast'
        : 'Cannot broadcast: invalid identity';
  }
}
