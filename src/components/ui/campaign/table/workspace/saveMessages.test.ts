import { describe, expect, it, vi } from 'vitest';

import {
  checkpointNotSaved,
  exportFailureReporter,
  restoreMessages,
  SAVE_MESSAGES,
  type SaveMessage,
  type SaveMessageTone,
} from './saveMessages';

/**
 * O7-3 W5 / W8R-7 (HN-1 "tag at source"): every save/scene message key the
 * Table page emits carries its tone where it is defined. Routine lines stay
 * in Details; everything else is a banner, failures in the failure tone and
 * counted on the Details trigger. No tone is ever derived from the text.
 */
const TONES: Record<keyof typeof SAVE_MESSAGES, SaveMessageTone> = {
  loading: 'routine',
  ready: 'routine',
  notFound: 'failure',
  notConnected: 'failure',
  storageUnavailable: 'failure',
  saving: 'progress',
  saved: 'success',
  savedWithNewerEdit: 'success',
  conflictDiscarded: 'success',
  conflictRefreshed: 'success',
  conflictRefreshFailed: 'failure',
  conflictApplied: 'success',
  conflictChangedAgain: 'failure',
  conflictNone: 'success',
  conflictApplyFailed: 'failure',
  arrivalSaved: 'success',
  arrivalNotSaved: 'failure',
  mapImageFailed: 'failure',
};

describe('save messages carry their tone at the source (O7-3 W5)', () => {
  it('covers every message key exactly', () => {
    expect(Object.keys(SAVE_MESSAGES).sort()).toEqual(
      Object.keys(TONES).sort()
    );
  });

  it.each(Object.entries(TONES))('%s → %s', (key, tone) => {
    const message = SAVE_MESSAGES[key as keyof typeof SAVE_MESSAGES];
    expect(message.tone).toBe(tone);
    expect(message.text.length).toBeGreaterThan(0);
  });

  it.each(['changes', 'checkpoint'] as const)(
    'restore messages for %s are tagged',
    kind => {
      const messages = restoreMessages(kind);
      expect(messages.busy.tone).toBe('progress');
      expect(messages.restored.tone).toBe('success');
      expect(messages.conflict.tone).toBe('failure');
      expect(messages.failed('unavailable').tone).toBe('failure');
      expect(messages.failed('unavailable').detail).toBe('unavailable');
    }
  );

  it('checkpoint failures keep the raw reason as detail only', () => {
    const draft: SaveMessage = checkpointNotSaved(
      'changes-kept',
      'relay-timeout'
    );
    const previous: SaveMessage = checkpointNotSaved('last-kept', 'conflict');
    expect(draft.tone).toBe('failure');
    expect(previous.tone).toBe('failure');
    expect(draft.detail).toBe('relay-timeout');
    expect(previous.detail).toBe('conflict');
    expect(draft.text).not.toMatch(/relay-timeout/u);
    expect(previous.text).not.toMatch(/conflict/u);
  });

  it('the same words never decide the tone: a progress-looking failure stays a failure', () => {
    expect(SAVE_MESSAGES.saving.text.endsWith('…')).toBe(true);
    expect(SAVE_MESSAGES.saving.tone).toBe('progress');
    expect(SAVE_MESSAGES.notFound.text.endsWith('…')).toBe(false);
    expect(SAVE_MESSAGES.notFound.tone).toBe('failure');
  });

  it('export errors are reported tagged as failures (HN-1 source tag)', () => {
    const notify = vi.fn();
    exportFailureReporter(notify)('Map is still loading');
    expect(notify).toHaveBeenCalledWith('Map is still loading', 'failure');
  });
});
