import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

import {
  exportFailureReporter,
  saveMessageTone,
  type SaveMessageTone,
} from './saveMessageTone';

/**
 * O7-2 HN-1 / HR-1: every save/scene message string the Table page emits,
 * classified. Routine lines stay in Details; everything else is a banner,
 * failures in the failure tone and counted on the Details trigger.
 */
const MESSAGES: Array<[string, SaveMessageTone]> = [
  ['Local scene loading…', 'routine'],
  ['Local scene ready', 'routine'],
  ['Waiting for explicit relay receipts…', 'progress'],
  ['Local draft is being guarded by the current generation…', 'progress'],
  ['Saved checkpoint is being guarded by the current generation…', 'progress'],
  ['Authoritative checkpoint committed locally.', 'success'],
  [
    'Authoritative checkpoint committed; a newer local edit is still pending.',
    'success',
  ],
  ['Local draft restored to live authority.', 'success'],
  ['Saved checkpoint restored to live authority.', 'success'],
  [
    'Pending conflicted edit discarded. The winning scene remains unchanged.',
    'success',
  ],
  [
    'Winning scene refreshed. The conflicted edit is still pending for deliberate retry or discard.',
    'success',
  ],
  [
    'Pending edit deliberately reapplied to the latest scene without replacing unrelated winner fields.',
    'success',
  ],
  ['There is no pending conflicted edit.', 'success'],
  ['Party arrival point saved on this device.', 'success'],
  ['Scene not found in this local workspace', 'failure'],
  [
    'Relay is not ready. The local draft remains saved on this device.',
    'failure',
  ],
  ['Table storage is unavailable; checkpoint not committed.', 'failure'],
  [
    'Checkpoint not committed (relay-timeout); the local draft remains pending.',
    'failure',
  ],
  [
    'Checkpoint not committed (conflict); the previous checkpoint is unchanged.',
    'failure',
  ],
  [
    'Local draft was not restored because live authority changed. Review the current scene and retry deliberately.',
    'failure',
  ],
  [
    'Saved checkpoint failed (unavailable); live authority and local data are unchanged.',
    'failure',
  ],
  [
    'The winning scene could not be refreshed; the conflicted edit remains pending.',
    'failure',
  ],
  [
    'The scene changed again. The edit remains pending and was not replayed.',
    'failure',
  ],
  ['The pending edit could not be applied and remains available.', 'failure'],
  ['The arrival point was not saved. Nothing changed.', 'failure'],
  ['Map image could not be loaded', 'failure'],
];

describe('save message tone (HN-1)', () => {
  it.each(MESSAGES)('%s → %s', (message, tone) => {
    expect(saveMessageTone(message)).toBe(tone);
  });

  it('export errors are reported tagged as failures (HN-1 source tag)', () => {
    const notify = vi.fn();
    exportFailureReporter(notify)('Map is still loading');
    expect(notify).toHaveBeenCalledWith('Map is still loading', 'failure');
    expect(saveMessageTone('Map is still loading')).toBe('success');
  });

  it('an explicit source tag wins (export errors carry arbitrary text)', () => {
    expect(saveMessageTone('Canvas too large to export', 'failure')).toBe(
      'failure'
    );
  });
});
