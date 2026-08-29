import { describe, expect, it } from 'vitest';

import {
  captureDeviceBackup,
  restoreRecoveryEntries,
} from '@/lib/deviceRecovery';
import { LEGACY_EXACT_KEYS } from '@/lib/indexeddb/migrationCapture';
import { CHARACTER_CLOUD_LINKS_STORAGE_KEY } from '@/lib/supabase/characterCloudLinks';

import {
  decideGenericRestoreWrite,
  GENERIC_RESTORE_DENIED_CONTROL_PREFIXES,
  genericRestorePreselectedKeys,
  shouldUseLegacyGenericCharacterRestore,
} from '../playerBackupRecoveryPolicy';

const VALID_STORE = '{"state":{"items":[]},"version":1}';
const VALID_V0 = '{"state":{"items":[]},"version":0}';
const VALID_PLAYER = '{"state":{"characters":[]},"version":1}';
const VALID_ENVELOPE =
  '{"state":{"character":{"id":"hero-1","name":"Hero"}},"version":0}';
const VALID_CANVAS = '{"shapes":[],"unknown":null}';

describe('playerBackupRecoveryPolicy', () => {
  it.each([...LEGACY_EXACT_KEYS])(
    'permits missing registered managed key %s under legacy authority',
    key => {
      expect(
        decideGenericRestoreWrite({
          key,
          rawValue:
            key === 'rollkeeper-player-data'
              ? VALID_PLAYER
              : key === 'rollkeeper-character' ||
                  key === 'rollkeeper-location-data' ||
                  key === 'rollkeeper-battlemap-data'
                ? VALID_V0
                : VALID_STORE,
          currentValue: null,
          authority: 'legacy',
        })
      ).toBe('restore');
    }
  );

  it('permits a valid character envelope and registered canvas keys under legacy authority', () => {
    expect(
      decideGenericRestoreWrite({
        key: 'rollkeeper-character:hero-1',
        rawValue: VALID_ENVELOPE,
        currentValue: null,
        authority: 'legacy',
      })
    ).toBe('restore');
    expect(
      decideGenericRestoreWrite({
        key: 'location-canvas-town',
        rawValue: VALID_CANVAS,
        currentValue: null,
        authority: 'legacy',
      })
    ).toBe('restore');
    expect(
      decideGenericRestoreWrite({
        key: 'battlemap-canvas-cave',
        rawValue: VALID_CANVAS,
        currentValue: null,
        authority: 'legacy',
      })
    ).toBe('restore');
  });

  it.each([
    ['character selection', 'rollkeeper:indexeddb-selection:guest:character'],
    ['npc selection', 'rollkeeper:npc-selection:guest:camp-1'],
    ['encounter selection', 'rollkeeper:encounter-selection:guest:camp-1'],
    [
      'campaign settings selection',
      'rollkeeper:campaign-settings-selection:guest:camp-1',
    ],
    ['calendar selection', 'rollkeeper:calendar-selection:guest:camp-1'],
    ['magic item selection', 'rollkeeper:magic-item-selection:guest:camp-1'],
    [
      'combat log archive selection',
      'rollkeeper:combat-log-archive-selection:guest:camp-1',
    ],
    ['migration lock', 'rollkeeper:indexeddb-migration'],
    ['cloud links', CHARACTER_CLOUD_LINKS_STORAGE_KEY],
    ['theme', 'rollkeeper-theme'],
    ['unknown hyphen key', 'rollkeeper-future-feature'],
    ['ownership', 'rollkeeper-character-ownership'],
    ['account', 'rollkeeper-account'],
    ['preference', 'rollkeeper-backup-preference'],
    ['receipt', 'rollkeeper-recovery-receipt'],
    ['pending work', 'rollkeeper:pending-work:abc'],
    ['consent run', 'rollkeeper-player-backup-run'],
  ] as const)(
    'denies control/unknown key %s even when missing',
    (_label, key) => {
      expect(
        decideGenericRestoreWrite({
          key,
          rawValue: VALID_STORE,
          currentValue: null,
          authority: 'legacy',
        })
      ).toBe('unavailable');
    }
  );

  it('lists every registered control prefix so the deny list cannot shrink silently', () => {
    expect(GENERIC_RESTORE_DENIED_CONTROL_PREFIXES).toEqual([
      'rollkeeper:indexeddb-selection:',
      'rollkeeper:npc-selection:',
      'rollkeeper:encounter-selection:',
      'rollkeeper:campaign-settings-selection:',
      'rollkeeper:calendar-selection:',
      'rollkeeper:magic-item-selection:',
      'rollkeeper:combat-log-archive-selection:',
      'rollkeeper:indexeddb-migration',
      'rollkeeper:pending-work:',
      CHARACTER_CLOUD_LINKS_STORAGE_KEY,
    ]);
  });

  it('never trusts a forged managed classification on denied keys', () => {
    const forged = [
      'rollkeeper:indexeddb-selection:guest:character',
      'rollkeeper-character-ownership',
      CHARACTER_CLOUD_LINKS_STORAGE_KEY,
      'rollkeeper-backup-preference',
      'rollkeeper-recovery-receipt',
      'rollkeeper:pending-work:abc',
      'rollkeeper-unknown-control',
    ];
    for (const key of forged) {
      expect(
        decideGenericRestoreWrite({
          key,
          rawValue: VALID_STORE,
          currentValue: null,
          authority: 'legacy',
          classification: 'managed',
        })
      ).toBe('unavailable');
    }
  });

  it('reports identical and collision without writing eligibility', () => {
    expect(
      decideGenericRestoreWrite({
        key: 'rollkeeper-player-data',
        rawValue: VALID_PLAYER,
        currentValue: VALID_PLAYER,
        authority: 'legacy',
      })
    ).toBe('identical');
    expect(
      decideGenericRestoreWrite({
        key: 'rollkeeper-player-data',
        rawValue: VALID_PLAYER,
        currentValue: '{"state":{"characters":[{"id":"kept"}]},"version":1}',
        authority: 'legacy',
      })
    ).toBe('collision');
  });

  it('does not preselect denied, identical, colliding, or quarantined keys', () => {
    const current = new Map<string, string>([
      ['rollkeeper-player-data', VALID_PLAYER],
      ['rollkeeper-dm-data', '{"state":{"dmId":"kept"},"version":1}'],
    ]);
    expect(
      genericRestorePreselectedKeys(
        [
          { key: 'rollkeeper-player-data', rawValue: VALID_PLAYER },
          {
            key: 'rollkeeper-dm-data',
            rawValue: '{"state":{"dmId":"file"},"version":1}',
          },
          { key: 'rollkeeper-npc-data', rawValue: VALID_STORE },
          { key: 'rollkeeper-future-feature', rawValue: 'opaque' },
          { key: 'rollkeeper-calendar-data', rawValue: '{broken' },
          {
            key: CHARACTER_CLOUD_LINKS_STORAGE_KEY,
            rawValue: '{"links":{}}',
          },
        ],
        key => current.get(key) ?? null,
        'legacy'
      )
    ).toEqual(['rollkeeper-npc-data']);
  });

  it('excludes every character-family key from generic restore under active authority', () => {
    for (const key of [
      'rollkeeper-character',
      'rollkeeper-player-data',
      'rollkeeper-character:hero-1',
    ]) {
      expect(
        decideGenericRestoreWrite({
          key,
          rawValue: key.startsWith('rollkeeper-character:')
            ? VALID_ENVELOPE
            : VALID_PLAYER,
          currentValue: null,
          authority: 'indexedDB',
        })
      ).toBe('unavailable');
    }
    expect(
      decideGenericRestoreWrite({
        key: 'rollkeeper-dm-data',
        rawValue: VALID_STORE,
        currentValue: null,
        authority: 'indexedDB',
      })
    ).toBe('restore');
  });

  it('treats invalid character envelopes as evidence-only under legacy authority', () => {
    expect(
      decideGenericRestoreWrite({
        key: 'rollkeeper-character:hero-1',
        rawValue: '{"state":{"character":{"id":"hero-b"}}}',
        currentValue: null,
        authority: 'legacy',
      })
    ).toBe('unavailable');
  });

  it('preview and restore share the policy so forged managed control keys never write', async () => {
    const bundle = await captureDeviceBackup(
      new Map([['rollkeeper-player-data', VALID_PLAYER]]),
      {
        appVersion: 'test',
        runId: 'policy-parity',
        timestamp: 'now',
      }
    );
    bundle.entries.push({
      key: CHARACTER_CLOUD_LINKS_STORAGE_KEY,
      rawValue: '{"links":{"forged":true}}',
      byteCount: 24,
      sha256: '0'.repeat(64),
      classification: 'managed',
    });
    const values = new Map<string, string>();
    const target = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const preselected = genericRestorePreselectedKeys(
      bundle.entries,
      key => target.getItem(key),
      'legacy'
    );
    expect(preselected).toEqual(['rollkeeper-player-data']);
    const result = restoreRecoveryEntries(bundle, target, [
      ...preselected,
      CHARACTER_CLOUD_LINKS_STORAGE_KEY,
    ]);
    expect(result.restored).toEqual(['rollkeeper-player-data']);
    expect(values.has(CHARACTER_CLOUD_LINKS_STORAGE_KEY)).toBe(false);
    expect(values.get('rollkeeper-player-data')).toBe(VALID_PLAYER);
  });

  it('cannot install a selection marker or character family values from a post-cutover broad file', async () => {
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-player-data', VALID_PLAYER],
        ['rollkeeper-dm-data', VALID_STORE],
      ]),
      {
        appVersion: 'test',
        runId: 'post-cutover',
        timestamp: 'now',
      }
    );
    bundle.entries.push({
      key: 'rollkeeper:indexeddb-selection:guest:character',
      rawValue: '{"version":1,"namespace":"guest","family":"character"}',
      byteCount: 56,
      sha256: '0'.repeat(64),
      classification: 'managed',
    });
    const values = new Map<string, string>();
    const target = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const result = restoreRecoveryEntries(
      bundle,
      target,
      bundle.entries.map(entry => entry.key),
      { authority: 'indexedDB' }
    );
    expect(result.restored).toEqual(['rollkeeper-dm-data']);
    expect(values.has('rollkeeper-player-data')).toBe(false);
    expect(values.has('rollkeeper:indexeddb-selection:guest:character')).toBe(
      false
    );
  });

  it('legacy fallback restores only missing character values and preserves collisions', async () => {
    const player = '{"state":{"characters":[{"id":"kept"}]},"version":1}';
    const envelope = '{"state":{"character":{"id":"hero-1"}},"version":0}';
    const bundle = await captureDeviceBackup(
      new Map([
        ['rollkeeper-player-data', '{"state":{"characters":[]},"version":1}'],
        ['rollkeeper-character:hero-1', envelope],
      ]),
      { appVersion: 'test', runId: 'legacy', timestamp: 'now' }
    );
    const values = new Map([['rollkeeper-player-data', player]]);
    const target = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const result = restoreRecoveryEntries(
      bundle,
      target,
      bundle.entries.map(entry => entry.key),
      { authority: 'legacy' }
    );
    expect(result).toMatchObject({
      restored: ['rollkeeper-character:hero-1'],
      conflicts: ['rollkeeper-player-data'],
    });
    expect(values.get('rollkeeper-player-data')).toBe(player);
    expect(values.get('rollkeeper-character:hero-1')).toBe(envelope);
  });

  it('uses generic legacy restore for any localStorage profile when local authority mutation is unavailable', () => {
    expect(
      shouldUseLegacyGenericCharacterRestore({
        authority: 'localStorage',
        localAuthorityMutation: false,
      })
    ).toBe(true);
    expect(
      shouldUseLegacyGenericCharacterRestore({
        authority: 'localStorage',
        localAuthorityMutation: true,
      })
    ).toBe(false);
    expect(
      shouldUseLegacyGenericCharacterRestore({
        authority: 'indexedDB',
        localAuthorityMutation: false,
      })
    ).toBe(false);
  });
});
