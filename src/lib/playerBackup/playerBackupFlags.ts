import { isAuthEnabled } from '@/lib/supabase/authConfig';

export type PlayerBackupSetupAvailability =
  | 'legacy'
  | 'unavailable'
  | 'read-only'
  | 'degraded-manual'
  | 'integrated-ongoing'
  | 'full';

export type PlayerBackupMode = 'ongoing' | 'one-time';

export interface PlayerBackupCapabilityInput {
  wizardVisible: boolean;
  authConfigured: boolean;
  manual: boolean;
  cutover: boolean;
  automatic: boolean;
  lockAvailable: boolean;
}

export interface PlayerBackupCallPolicy {
  accountRead: boolean;
  manualRead: boolean;
  automaticRead: boolean;
  recovery: boolean;
  confirm: boolean;
  manualMutation: boolean;
  automaticMutation: boolean;
  localAuthorityMutation: boolean;
}

export interface PlayerBackupCapabilities extends PlayerBackupCapabilityInput {
  surfaceOwner: 'legacy' | 'wizard';
  setup: PlayerBackupSetupAvailability;
  modes: readonly PlayerBackupMode[];
  calls: PlayerBackupCallPolicy;
}

const NO_WIZARD_CALLS: PlayerBackupCallPolicy = {
  accountRead: false,
  manualRead: false,
  automaticRead: false,
  recovery: false,
  confirm: false,
  manualMutation: false,
  automaticMutation: false,
  localAuthorityMutation: false,
};

export function isPlayerBackupWizardVisible(): boolean {
  return process.env.NEXT_PUBLIC_PLAYER_BACKUP_WIZARD_VISIBLE === 'true';
}

export function derivePlayerBackupCapabilities(
  input: PlayerBackupCapabilityInput
): PlayerBackupCapabilities {
  if (!input.wizardVisible) {
    return {
      ...input,
      surfaceOwner: 'legacy',
      setup: 'legacy',
      modes: [],
      calls: NO_WIZARD_CALLS,
    };
  }

  const readPolicy: PlayerBackupCallPolicy = {
    accountRead: input.authConfigured,
    manualRead: input.authConfigured && input.manual,
    automaticRead: input.authConfigured && input.cutover && input.automatic,
    recovery: true,
    confirm: false,
    manualMutation: false,
    automaticMutation: false,
    localAuthorityMutation: false,
  };

  if (!input.authConfigured) {
    return {
      ...input,
      surfaceOwner: 'wizard',
      setup: 'unavailable',
      modes: [],
      calls: readPolicy,
    };
  }

  if (!input.lockAvailable) {
    return {
      ...input,
      surfaceOwner: 'wizard',
      setup: 'read-only',
      modes: [],
      calls: readPolicy,
    };
  }

  const integrated = input.cutover && input.automatic;
  if (!input.manual && !integrated) {
    return {
      ...input,
      surfaceOwner: 'wizard',
      setup: 'unavailable',
      modes: [],
      calls: readPolicy,
    };
  }

  if (!integrated) {
    return {
      ...input,
      surfaceOwner: 'wizard',
      setup: 'degraded-manual',
      modes: ['one-time'],
      calls: {
        ...readPolicy,
        confirm: true,
        manualMutation: true,
      },
    };
  }

  if (!input.manual) {
    return {
      ...input,
      surfaceOwner: 'wizard',
      setup: 'integrated-ongoing',
      modes: ['ongoing'],
      calls: {
        ...readPolicy,
        confirm: true,
        automaticMutation: true,
        localAuthorityMutation: true,
      },
    };
  }

  return {
    ...input,
    surfaceOwner: 'wizard',
    setup: 'full',
    modes: ['ongoing', 'one-time'],
    calls: {
      ...readPolicy,
      confirm: true,
      manualMutation: true,
      automaticMutation: true,
      localAuthorityMutation: true,
    },
  };
}

export function readPlayerBackupCapabilities(
  lockAvailable: boolean
): PlayerBackupCapabilities {
  return derivePlayerBackupCapabilities({
    wizardVisible: isPlayerBackupWizardVisible(),
    authConfigured: isAuthEnabled(),
    manual:
      process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_BACKUP_ENABLED === 'true',
    cutover:
      process.env.NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED === 'true',
    automatic:
      process.env.NEXT_PUBLIC_SUPABASE_CHARACTER_AUTOMATIC_SYNC_ENABLED ===
      'true',
    lockAvailable,
  });
}
