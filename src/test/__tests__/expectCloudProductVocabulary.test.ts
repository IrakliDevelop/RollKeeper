/**
 * Load-bearing proof for `expectCloudProductVocabulary` (Task 18b, ruling
 * R5.2). The plan's own snippet only ever scanned `container.textContent`,
 * which cannot see accessible names — an icon-only button whose forbidden
 * word lives entirely in `aria-label` would render clean text and still pass
 * a plain textContent scan. Every case here is proven red-then-restored: the
 * assertion must actually fail before we trust it to catch a real
 * regression, and must actually pass on R17-clean markup and on the
 * documented internal-identifier exceptions.
 */
import { describe, expect, it } from 'vitest';

import { expectCloudProductVocabulary } from '@/test/helpers';

function containerWith(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

describe('expectCloudProductVocabulary', () => {
  it('passes on R17-clean copy', () => {
    const container = containerWith(`
      <p>Saved only in this browser</p>
      <button aria-label="Move campaign data to cloud sync">Continue</button>
      <input placeholder="Type to confirm" title="Confirmation input" />
      <img alt="Cloud sync status" />
    `);
    expect(() => expectCloudProductVocabulary(container)).not.toThrow();
  });

  it('reddens on forbidden visible text ("device")', () => {
    const container = containerWith('<p>Saved only on this device</p>');
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on forbidden visible text ("family")', () => {
    const container = containerWith('<p>Activate cloud family</p>');
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on "whole-device"', () => {
    const container = containerWith('<p>Start the whole-device migration</p>');
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on "deliveries"', () => {
    const container = containerWith('<p>Check your deliveries</p>');
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on "player inbox" (Slice 13 concept, must not leak into 11G)', () => {
    const container = containerWith('<p>Open your player inbox</p>');
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on a forbidden word that is invisible as text but present as an aria-label', () => {
    // A plain container.textContent scan would see "Continue" and pass;
    // this is exactly the accessible-name gap R5.2 requires closing.
    const container = containerWith(
      '<button aria-label="Enroll this device">Continue</button>'
    );
    expect(container.textContent).not.toMatch(/device/i);
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on a forbidden word reached only through aria-labelledby', () => {
    const container = containerWith(`
      <span id="label-1">Remove this account from this device</span>
      <button aria-labelledby="label-1">X</button>
    `);
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on a forbidden word present only in a title attribute', () => {
    const container = containerWith(
      '<span title="Another device changed this">i</span>'
    );
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on a forbidden word present only in a placeholder attribute', () => {
    const container = containerWith(
      '<input placeholder="Type this device\'s name" />'
    );
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on a forbidden word present only in an alt attribute', () => {
    const container = containerWith('<img alt="Device backup diagram" />');
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('does not fire on the allowed internal literal rollkeeper-device-backup', () => {
    // Load-bearing: 'device' in 'rollkeeper-device-backup' IS surrounded by
    // hyphens (non-word characters), so \bdevice\b matches it unless the
    // literal is stripped first -- unlike the camelCase/PascalCase
    // identifiers covered by the next test, this is the one allowlist entry
    // that actually does something.
    const container = containerWith(
      '<p>Downloaded file: rollkeeper-device-backup-2026-08-24.json</p>'
    );
    expect(() => expectCloudProductVocabulary(container)).not.toThrow();
  });

  it('never needs an allowlist entry for deviceId or DeviceBackupV1: the base regex cannot match "device"/"Device" fused into a camelCase or PascalCase identifier', () => {
    // Coordinator review round 1, Minor 3: an earlier version of this file
    // allowlisted 'deviceId' and 'DeviceBackupV1' and asserted the guard
    // does not fire on them -- but \bdevice(?:s|'s|-only)?\b requires a
    // WORD-BOUNDARY immediately after "device"/"Device", and there is none
    // between "device"/"Device" and the following "Id"/"Backup" (both are
    // word characters). The guard was already structurally incapable of
    // matching either identifier, with or without an allowlist entry, so
    // those two entries and their "does not fire" tests proved nothing --
    // deleting either one left every test green. Removed from
    // `ALLOWED_INTERNAL_VOCABULARY_LITERALS`; this test instead pins the
    // real invariant (the regex's word-boundary precision) so a future
    // change that loosens it (e.g. dropping the `\b`) is caught here.
    const container = containerWith(
      '<p>debug: deviceId=abc123, format: DeviceBackupV1</p>'
    );
    expect(() => expectCloudProductVocabulary(container)).not.toThrow();
  });

  it('still catches a real "device" word standing next to a stripped internal literal', () => {
    // Guards against a scrubber that is too eager and swallows adjacent
    // legitimate violations along with the literal it is meant to strip.
    const container = containerWith(
      '<p>deviceId debug dump: this device is not enrolled</p>'
    );
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('reddens on a forbidden word present on the CONTAINER element itself, not only its descendants', () => {
    // Coordinator review round 1, Minor 6: `querySelectorAll` only returns
    // descendants -- it never matches the element it is called on. A
    // caller passing an element that IS itself the accessible-name-bearing
    // node (e.g. `render(<Dialog aria-label="...">)`'s root, or `screen`
    // helpers that return the labelled element directly rather than a
    // wrapper) had that attribute silently unscanned.
    const container = document.createElement('div');
    container.setAttribute('aria-label', 'Enroll this device');
    document.body.appendChild(container);
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });

  it('matches a forbidden two-word phrase naturally split across sibling text nodes by ordinary single-space markup', () => {
    // Coordinator review round 1, Minor 6: the previous fix for the
    // word-fusion bug (see `collectTextNodes`'s own doc comment) joined
    // every text-node boundary with a fixed ' \n ' separator. That broke
    // the OPPOSITE case: `<span>player</span> <span>inbox</span>` walks as
    // three text nodes ("player", the single real space between the spans,
    // "inbox"), and forcing ' \n ' at both boundaries turned that one real
    // space into several, so `/player inbox/i`'s literal single space no
    // longer matched. This is exactly the kind of split real markup
    // produces (two inline elements with ordinary whitespace between them),
    // so it has to keep matching.
    const container = containerWith(
      '<span>Open your player</span> <span>inbox</span>'
    );
    expect(() => expectCloudProductVocabulary(container)).toThrow();
  });
});
