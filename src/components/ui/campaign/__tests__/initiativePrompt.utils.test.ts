import { describe, it, expect, beforeEach } from 'vitest';

import {
  shouldShowInitiativePrompt,
  getSubmittedRequestId,
  markSubmitted,
} from '@/components/ui/campaign/initiativePrompt.utils';

const req = {
  requestId: 'r1',
  encounterId: 'e1',
  encounterName: 'X',
  requestedAt: 1,
};

describe('initiativePrompt.utils', () => {
  beforeEach(() => localStorage.clear());

  it('shows only for an unanswered request outside combat', () => {
    expect(
      shouldShowInitiativePrompt({
        request: req,
        initiativeActive: false,
        submittedRequestId: null,
      })
    ).toBe(true);
    expect(
      shouldShowInitiativePrompt({
        request: null,
        initiativeActive: false,
        submittedRequestId: null,
      })
    ).toBe(false);
    expect(
      shouldShowInitiativePrompt({
        request: req,
        initiativeActive: true,
        submittedRequestId: null,
      })
    ).toBe(false);
    expect(
      shouldShowInitiativePrompt({
        request: req,
        initiativeActive: false,
        submittedRequestId: 'r1',
      })
    ).toBe(false);
    expect(
      shouldShowInitiativePrompt({
        request: req,
        initiativeActive: false,
        submittedRequestId: 'older',
      })
    ).toBe(true);
  });

  it('round-trips submitted ids per character', () => {
    expect(getSubmittedRequestId('char-1')).toBeNull();
    markSubmitted('char-1', 'r1');
    markSubmitted('char-2', 'r9');
    expect(getSubmittedRequestId('char-1')).toBe('r1');
    expect(getSubmittedRequestId('char-2')).toBe('r9');
  });
});
