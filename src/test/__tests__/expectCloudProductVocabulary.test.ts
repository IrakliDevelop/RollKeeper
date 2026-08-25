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
    const container = containerWith(
      '<p>Downloaded file: rollkeeper-device-backup-2026-08-24.json</p>'
    );
    expect(() => expectCloudProductVocabulary(container)).not.toThrow();
  });

  it('does not fire on the allowed internal literal deviceId', () => {
    const container = containerWith('<p>debug: deviceId=abc123</p>');
    expect(() => expectCloudProductVocabulary(container)).not.toThrow();
  });

  it('does not fire on the allowed internal literal DeviceBackupV1', () => {
    const container = containerWith('<p>format: DeviceBackupV1</p>');
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
});
