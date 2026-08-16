export const MIGRATION_STATES = [
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
] as const;

export type MigrationState = (typeof MIGRATION_STATES)[number];

const LEGAL_TRANSITIONS: Readonly<
  Record<MigrationState, readonly MigrationState[]>
> = {
  LEGACY_PRIMARY: ['PREFLIGHT'],
  PREFLIGHT: ['CAPTURING', 'BLOCKED', 'RECOVERY_REQUIRED'],
  CAPTURING: ['CAPTURED', 'BLOCKED', 'RECOVERY_REQUIRED'],
  CAPTURED: ['TRANSFORMING', 'BLOCKED', 'RECOVERY_REQUIRED'],
  TRANSFORMING: ['VALIDATED', 'BLOCKED', 'RECOVERY_REQUIRED'],
  VALIDATED: ['SHADOWING', 'BLOCKED', 'RECOVERY_REQUIRED'],
  SHADOWING: [
    'CUTOVER_READY',
    'BLOCKED',
    'ROLLBACK_PENDING',
    'RECOVERY_REQUIRED',
  ],
  CUTOVER_READY: ['SHADOWING', 'ROLLBACK_PENDING', 'BLOCKED'],
  BLOCKED: ['PREFLIGHT', 'RECOVERY_REQUIRED'],
  ROLLBACK_PENDING: ['ROLLED_BACK', 'RECOVERY_REQUIRED'],
  ROLLED_BACK: ['PREFLIGHT'],
  RECOVERY_REQUIRED: ['PREFLIGHT'],
};

export function isMigrationTransitionAllowed(
  from: MigrationState,
  to: MigrationState
): boolean {
  return from === to || LEGAL_TRANSITIONS[from].includes(to);
}

export function assertMigrationTransition(
  from: MigrationState,
  to: MigrationState
): MigrationState {
  if (!isMigrationTransitionAllowed(from, to)) {
    throw new Error(`Illegal migration transition: ${from} -> ${to}`);
  }
  return to;
}
