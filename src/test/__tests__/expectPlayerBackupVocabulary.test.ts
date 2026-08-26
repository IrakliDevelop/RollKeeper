import { describe, expect, it } from 'vitest';

import { expectPlayerBackupVocabulary } from '@/test/helpers';

const forbidden = [
  'IndexedDB',
  'localStorage',
  'manifest',
  'schema',
  'authority',
  'epoch',
  'cutover',
  'migration',
  'namespace',
  'mutation',
  'outbox',
  'tombstone',
  'quarantine',
  'CAS',
  'device',
  'workflow',
  'canary',
  'workspace',
  'sync',
  'synchronization',
  'synchronized',
  '\u2014',
];

function element(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

describe('expectPlayerBackupVocabulary', () => {
  it.each(forbidden)('rejects %s in visible text', word => {
    expect(() =>
      expectPlayerBackupVocabulary(element(`<p>Unsafe ${word} detail</p>`))
    ).toThrow();
  });

  it.each(['aria-label', 'title', 'placeholder', 'alt'])(
    'rejects a violation in %s',
    attribute => {
      expect(() =>
        expectPlayerBackupVocabulary(
          element(`<input ${attribute}="Storage schema detail" />`)
        )
      ).toThrow();
    }
  );

  it('rejects resolved aria-labelledby text and root-element attributes', () => {
    const label = document.createElement('span');
    label.id = 'unsafe-label';
    label.textContent = 'Device state';
    document.body.appendChild(label);
    expect(() =>
      expectPlayerBackupVocabulary(
        element('<button aria-labelledby="unsafe-label">Open</button>')
      )
    ).toThrow();

    const root = document.createElement('div');
    root.title = 'Sync status';
    expect(() => expectPlayerBackupVocabulary(root)).toThrow();
  });

  it('rejects a forbidden phrase split across descendants', () => {
    expect(() =>
      expectPlayerBackupVocabulary(
        element('<span>local</span><span>Storage</span>')
      )
    ).toThrow();
  });

  it('accepts plain player-facing copy', () => {
    expect(() =>
      expectPlayerBackupVocabulary(
        element(
          '<p>Your characters are safe in this browser.</p><button aria-label="Save safety file">Save</button>'
        )
      )
    ).not.toThrow();
  });
});
