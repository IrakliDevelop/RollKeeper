import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { changedOnAnotherBrowserMessage } from '@/lib/durableDm/familyConflictMessage';

import {
  cloudActivationFailureMessage,
  friendlyMigrationMessage,
  type MigrationErrorChannel,
} from './migrationCopy';

/**
 * Final fix wave, F1 and F4. Two properties, both of which the whole-branch
 * review found unpinned in BOTH directions (mutation M14 deleted the render
 * outright and 619/619 still passed):
 *
 *  1. every internal `CloudActivationConflictReason` maps to product copy,
 *     and the token itself never survives the mapping;
 *  2. no rejection — an adapter throw, a `DOMException`, a raw transport
 *     string — ever comes back out of the friendly mapping verbatim.
 */

/**
 * The four members of `CloudActivationConflictReason`, restated here as
 * literals rather than imported from the source union. Importing the union
 * would make this table self-fulfilling (ruling R8.4's principle): a member
 * deleted from production would silently vanish from the test too.
 */
const ACTIVATION_REASONS = [
  'cloud-generation-diverged',
  'cloud-epoch-unknown',
  'cloud-epoch-unexpected',
  'cloud-preview-unusable',
] as const;

const CHANNELS: MigrationErrorChannel[] = [
  'preview',
  'browserRecord',
  'run',
  'repair',
  'verify',
  // Re-review N1: the three channels outside the family step. Same reason
  // as `ACTIVATION_REASONS` above for restating them as literals — a member
  // deleted from the union must redden this table, not disappear from it.
  'discovery',
  'backupFile',
  'backupRecord',
];

/** R17's forbidden vocabulary, applied to every string this module can emit. */
const FORBIDDEN = [
  /\bdevice(?:s|'s|-only)?\b/i,
  /\bfamil(?:y|ies)\b/i,
  /\bwhole-device\b/i,
  /\bdeliveries\b/i,
  /player inbox/i,
];

describe('migrationCopy', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cloudActivationFailureMessage', () => {
    it.each(ACTIVATION_REASONS)(
      'maps %s to product copy that never contains the token itself',
      reason => {
        const message = cloudActivationFailureMessage(reason);
        expect(message).not.toBe(reason);
        expect(message).not.toContain(reason);
        // The shared prefix every token carries. A mapping that "translated"
        // a token by lightly rewording it would still fail here.
        expect(message).not.toMatch(/cloud-/);
        expect(message.length).toBeGreaterThan(40);
        for (const pattern of FORBIDDEN) expect(message).not.toMatch(pattern);
      }
    );

    it('gives every reason its OWN sentence, so the mapping discriminates', () => {
      const messages = ACTIVATION_REASONS.map(cloudActivationFailureMessage);
      expect(new Set(messages).size).toBe(ACTIVATION_REASONS.length);
    });

    it('never renders an unknown reason verbatim either', () => {
      const message = cloudActivationFailureMessage('cloud-something-new');
      expect(message).not.toContain('cloud-something-new');
      expect(message).not.toMatch(/cloud-/);
      for (const pattern of FORBIDDEN) expect(message).not.toMatch(pattern);
    });
  });

  describe('friendlyMigrationMessage', () => {
    it.each(CHANNELS)(
      '%s: never returns raw platform text, and logs it instead',
      channel => {
        const message = friendlyMigrationMessage(
          channel,
          new TypeError('Failed to fetch')
        );
        expect(message).not.toContain('Failed to fetch');
        expect(console.error).toHaveBeenCalledWith(
          `[MigrationWizard] ${channel} failed:`,
          'Failed to fetch'
        );
        for (const pattern of FORBIDDEN) expect(message).not.toMatch(pattern);
      }
    );

    it.each(CHANNELS)(
      '%s: never returns a raw DOMException message',
      channel => {
        const message = friendlyMigrationMessage(
          channel,
          new DOMException(
            'The user denied permission to access the database.',
            'UnknownError'
          )
        );
        expect(message).not.toContain('denied permission');
      }
    );

    it.each(CHANNELS)('%s: never returns a non-Error rejection', channel => {
      const message = friendlyMigrationMessage(channel, {
        secretish: 'raw-internal-payload',
      });
      expect(message).not.toContain('raw-internal-payload');
      expect(message).not.toContain('object Object');
    });

    it.each(CHANNELS)(
      '%s: recognises the shared changed-on-another-browser message',
      channel => {
        const message = friendlyMigrationMessage(
          channel,
          // The REAL producer, from the module that also exports the pattern
          // the mapping recognises -- so this stays bound to production copy
          // rather than restating it.
          new Error(changedOnAnotherBrowserMessage('NPCs'))
        );
        expect(message).toMatch(/changed somewhere else/i);
        expect(message).not.toContain(changedOnAnotherBrowserMessage('NPCs'));
      }
    );

    it('gives each channel its own fallback, so the DM learns which step failed', () => {
      const messages = CHANNELS.map(channel =>
        friendlyMigrationMessage(channel, new Error('boom'))
      );
      expect(new Set(messages).size).toBe(CHANNELS.length);
    });
  });
});
