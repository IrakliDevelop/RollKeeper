import { isCharacterFamilyKey } from '@/lib/indexeddb/characterFamily';
import { LEGACY_EXACT_KEYS } from '@/lib/indexeddb/migrationCapture';
import { validateLegacyEnvelope } from '@/lib/indexeddb/migrationValidation';
import { CHARACTER_CLOUD_LINKS_STORAGE_KEY } from '@/lib/supabase/characterCloudLinks';

export type CharacterRecoveryAuthority = 'legacy' | 'indexedDB';

export type GenericRestoreDecision =
  | 'restore'
  | 'identical'
  | 'collision'
  | 'unavailable';

export interface GenericRestoreDecisionInput {
  key: string;
  rawValue: string;
  currentValue: string | null;
  authority: CharacterRecoveryAuthority;
  classification?: string;
}

export const GENERIC_RESTORE_DENIED_CONTROL_PREFIXES = [
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
] as const;

const MANAGED_EXACT_KEYS = new Set<string>(LEGACY_EXACT_KEYS);

function isDeniedControlKey(key: string): boolean {
  return GENERIC_RESTORE_DENIED_CONTROL_PREFIXES.some(prefix =>
    prefix.endsWith(':') || prefix.endsWith('-')
      ? key.startsWith(prefix)
      : key === prefix ||
        key.startsWith(`${prefix}:`) ||
        key.startsWith(`${prefix}-`)
  );
}

function isCanvasKey(key: string): boolean {
  return (
    key.startsWith('location-canvas-') || key.startsWith('battlemap-canvas-')
  );
}

export function isGenericRestorePermitted(
  key: string,
  rawValue: string,
  authority: CharacterRecoveryAuthority
): boolean {
  if (isDeniedControlKey(key)) return false;
  if (isCharacterFamilyKey(key) && authority === 'indexedDB') return false;
  if (isCanvasKey(key)) {
    return validateLegacyEnvelope(key, rawValue).status === 'valid';
  }
  if (MANAGED_EXACT_KEYS.has(key)) {
    return validateLegacyEnvelope(key, rawValue).status === 'valid';
  }
  if (key.startsWith('rollkeeper-character:') && authority === 'legacy') {
    return validateLegacyEnvelope(key, rawValue).status === 'valid';
  }
  return false;
}

export function decideGenericRestoreWrite(
  input: GenericRestoreDecisionInput
): GenericRestoreDecision {
  if (!isGenericRestorePermitted(input.key, input.rawValue, input.authority)) {
    return 'unavailable';
  }
  if (input.currentValue === null) return 'restore';
  if (input.currentValue === input.rawValue) return 'identical';
  return 'collision';
}

export function genericRestorePreselectedKeys(
  entries: readonly { key: string; rawValue: string }[],
  currentValue: (key: string) => string | null,
  authority: CharacterRecoveryAuthority
): string[] {
  return entries
    .filter(
      entry =>
        decideGenericRestoreWrite({
          key: entry.key,
          rawValue: entry.rawValue,
          currentValue: currentValue(entry.key),
          authority,
        }) === 'restore'
    )
    .map(entry => entry.key);
}

export function shouldUseLegacyGenericCharacterRestore(options: {
  authority: 'localStorage' | 'indexedDB';
  localAuthorityMutation: boolean;
}): boolean {
  return (
    options.authority === 'localStorage' && !options.localAuthorityMutation
  );
}
