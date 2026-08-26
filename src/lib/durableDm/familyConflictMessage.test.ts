import { describe, expect, it } from 'vitest';

import {
  CHANGED_ON_ANOTHER_BROWSER_PATTERN,
  changedOnAnotherBrowserMessage,
} from './familyConflictMessage';

// The exact labels the six `*Api.ts` gateways pass today. Keeping this list
// here (rather than importing each gateway module, which would require
// mocking `fetch` six times just to read a string) is deliberate: this test
// exists to prove the BUILDER and the PATTERN cannot drift apart, not to
// re-prove each gateway calls the builder correctly -- that half is proven
// per-family by each `*SyncService.test.ts`'s `HttpGateway` describe block.
const REAL_GATEWAY_LABELS = [
  'Calendar',
  'Campaign settings',
  'Magic item library',
  'NPCs',
  'Encounters',
  'Combat log archives',
];

describe('changedOnAnotherBrowserMessage / CHANGED_ON_ANOTHER_BROWSER_PATTERN', () => {
  it.each(REAL_GATEWAY_LABELS)(
    'the message built for %s is recognised by the pattern',
    label => {
      const message = changedOnAnotherBrowserMessage(label);
      expect(CHANGED_ON_ANOTHER_BROWSER_PATTERN.test(message)).toBe(true);
    }
  );

  it('never renders "device" wording', () => {
    for (const label of REAL_GATEWAY_LABELS) {
      expect(changedOnAnotherBrowserMessage(label)).not.toMatch(/\bdevice\b/i);
    }
  });

  it('does not match an unrelated failure message', () => {
    expect(
      CHANGED_ON_ANOTHER_BROWSER_PATTERN.test('NPC cloud request failed.')
    ).toBe(false);
  });
});
