// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sanitizeRichText } from './sanitizeRichText';
import { HOSTILE_CASES, UNCHANGED_INPUTS } from './sanitizeRichText.fixtures';

// RichTextRenderer is server-rendered, so the sanitiser must not need a DOM.
// The jsdom test and the Chromium story check the same fixtures.
describe('sanitizeRichText in Node', () => {
  it('runs without a DOM', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof DOMParser).toBe('undefined');
  });

  it.each(UNCHANGED_INPUTS.map(input => [input]))(
    'passes %j through unchanged',
    input => {
      expect(sanitizeRichText(input)).toBe(input);
    }
  );

  it.each(HOSTILE_CASES.map(c => [c.name, c]))('%s', (_name, c) => {
    expect(sanitizeRichText(c.input)).toBe(c.expected);
  });
});
