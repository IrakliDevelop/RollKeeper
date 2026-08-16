import { describe, expect, it } from 'vitest';

import {
  MIGRATION_STATES,
  assertMigrationTransition,
  isMigrationTransitionAllowed,
} from '@/lib/indexeddb/migrationState';

const LEGAL_TRANSITIONS: ReadonlySet<string> = new Set([
  'LEGACY_PRIMARY>PREFLIGHT',
  'PREFLIGHT>CAPTURING',
  'PREFLIGHT>BLOCKED',
  'PREFLIGHT>RECOVERY_REQUIRED',
  'CAPTURING>CAPTURED',
  'CAPTURING>BLOCKED',
  'CAPTURING>RECOVERY_REQUIRED',
  'CAPTURED>TRANSFORMING',
  'CAPTURED>BLOCKED',
  'CAPTURED>RECOVERY_REQUIRED',
  'TRANSFORMING>VALIDATED',
  'TRANSFORMING>BLOCKED',
  'TRANSFORMING>RECOVERY_REQUIRED',
  'VALIDATED>SHADOWING',
  'VALIDATED>BLOCKED',
  'VALIDATED>RECOVERY_REQUIRED',
  'SHADOWING>CUTOVER_READY',
  'SHADOWING>BLOCKED',
  'SHADOWING>ROLLBACK_PENDING',
  'SHADOWING>RECOVERY_REQUIRED',
  'CUTOVER_READY>SHADOWING',
  'CUTOVER_READY>ROLLBACK_PENDING',
  'CUTOVER_READY>BLOCKED',
  'BLOCKED>PREFLIGHT',
  'BLOCKED>RECOVERY_REQUIRED',
  'ROLLBACK_PENDING>ROLLED_BACK',
  'ROLLBACK_PENDING>RECOVERY_REQUIRED',
  'ROLLED_BACK>PREFLIGHT',
  'RECOVERY_REQUIRED>PREFLIGHT',
]);

describe('IndexedDB migration state machine', () => {
  it('contains exactly the Slice 7 states and no authority-switch state', () => {
    expect(MIGRATION_STATES).toEqual([
      'LEGACY_PRIMARY',
      'PREFLIGHT',
      'CAPTURING',
      'CAPTURED',
      'TRANSFORMING',
      'VALIDATED',
      'SHADOWING',
      'CUTOVER_READY',
      'BLOCKED',
      'ROLLBACK_PENDING',
      'ROLLED_BACK',
      'RECOVERY_REQUIRED',
    ]);
    expect(MIGRATION_STATES).not.toContain('IDB_PRIMARY');
  });

  it('covers every legal and illegal state-pair branch', () => {
    for (const from of MIGRATION_STATES) {
      for (const to of MIGRATION_STATES) {
        const expected = from === to || LEGAL_TRANSITIONS.has(`${from}>${to}`);
        expect(isMigrationTransitionAllowed(from, to), `${from} -> ${to}`).toBe(
          expected
        );
        if (expected) {
          expect(assertMigrationTransition(from, to)).toBe(to);
        } else {
          expect(() => assertMigrationTransition(from, to)).toThrow(
            `Illegal migration transition: ${from} -> ${to}`
          );
        }
      }
    }
  });
});
