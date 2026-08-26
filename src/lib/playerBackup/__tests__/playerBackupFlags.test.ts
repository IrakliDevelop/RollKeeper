import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  derivePlayerBackupCapabilities,
  isPlayerBackupWizardVisible,
} from '../playerBackupFlags';

const original = process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;

afterEach(() => {
  process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = original;
});

describe('player backup capability flags', () => {
  it('enables the umbrella only for the exact string true', () => {
    for (const value of [undefined, 'false', 'TRUE', '1']) {
      if (value === undefined)
        delete process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE;
      else process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = value;
      expect(isPlayerBackupWizardVisible()).toBe(false);
    }
    process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE = 'true';
    expect(isPlayerBackupWizardVisible()).toBe(true);
  });

  it('defines a non-mutating policy for all eight lower-flag combinations', () => {
    for (const manual of [false, true]) {
      for (const cutover of [false, true]) {
        for (const automatic of [false, true]) {
          const plan = derivePlayerBackupCapabilities({
            wizardVisible: true,
            authConfigured: true,
            lockAvailable: true,
            manual,
            cutover,
            automatic,
          });
          expect(plan.surfaceOwner).toBe('wizard');
          expect(plan.calls.accountRead).toBe(true);
          expect(plan.calls.manualRead).toBe(manual);
          expect(plan.calls.automaticRead).toBe(cutover && automatic);
          expect(plan.calls.recovery).toBe(true);

          if (!manual && (!cutover || !automatic)) {
            expect(plan.setup).toBe('unavailable');
            expect(plan.modes).toEqual([]);
            expect(plan.calls).toMatchObject({
              confirm: false,
              manualMutation: false,
              automaticMutation: false,
              localAuthorityMutation: false,
            });
          } else if (manual && (!cutover || !automatic)) {
            expect(plan.setup).toBe('degraded-manual');
            expect(plan.modes).toEqual(['one-time']);
            expect(plan.calls.localAuthorityMutation).toBe(false);
            expect(plan.calls.automaticMutation).toBe(false);
          } else if (!manual) {
            expect(plan.setup).toBe('integrated-ongoing');
            expect(plan.modes).toEqual(['ongoing']);
          } else {
            expect(plan.setup).toBe('full');
            expect(plan.modes).toEqual(['ongoing', 'one-time']);
          }
        }
      }
    }
  });

  it('keeps reads and recovery available but fails every mutation closed without a lock', () => {
    const plan = derivePlayerBackupCapabilities({
      wizardVisible: true,
      authConfigured: true,
      lockAvailable: false,
      manual: true,
      cutover: true,
      automatic: true,
    });
    expect(plan.setup).toBe('read-only');
    expect(plan.calls).toMatchObject({
      accountRead: true,
      manualRead: true,
      automaticRead: true,
      recovery: true,
      confirm: false,
      manualMutation: false,
      automaticMutation: false,
      localAuthorityMutation: false,
    });
  });

  it('does not construct auth or lower capabilities when auth is unavailable', () => {
    const plan = derivePlayerBackupCapabilities({
      wizardVisible: true,
      authConfigured: false,
      lockAvailable: true,
      manual: true,
      cutover: true,
      automatic: true,
    });
    expect(plan.setup).toBe('unavailable');
    expect(plan.calls).toEqual({
      accountRead: false,
      manualRead: false,
      automaticRead: false,
      recovery: true,
      confirm: false,
      manualMutation: false,
      automaticMutation: false,
      localAuthorityMutation: false,
    });
  });

  it('documents every relevant sample flag exactly once and default-off', () => {
    const sample = fs.readFileSync(
      path.resolve(process.cwd(), '.env.example'),
      'utf8'
    );
    for (const flag of [
      'NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE',
      'NEXT_PUBLIC_SUPABASE_AUTH_ENABLED',
      'NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED',
      'NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED',
      'NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED',
    ]) {
      const matches = sample.match(new RegExp(`^${flag}=false$`, 'gm')) ?? [];
      expect(matches, flag).toHaveLength(1);
      expect(sample.match(new RegExp(`^${flag}=`, 'gm')), flag).toHaveLength(1);
    }
  });
});
