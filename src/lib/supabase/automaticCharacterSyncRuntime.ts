import type { AutomaticSyncLocalCharacter } from './automaticCharacterSyncService';

interface AutomaticCharacterSyncRuntime {
  accountId: string;
  recordEdit(
    character: AutomaticSyncLocalCharacter
  ): Promise<'queued' | 'local-only'>;
  recordDelete(
    character: AutomaticSyncLocalCharacter
  ): Promise<'queued' | 'local-only'>;
  wake(): Promise<void>;
  stop(): void;
}

let activeRuntime: AutomaticCharacterSyncRuntime | null = null;

export function configureAutomaticCharacterSyncRuntime(
  runtime: AutomaticCharacterSyncRuntime
): void {
  if (activeRuntime !== runtime) activeRuntime?.stop();
  activeRuntime = runtime;
}

export function clearAutomaticCharacterSyncRuntime(accountId?: string): void {
  if (!activeRuntime || (accountId && activeRuntime.accountId !== accountId)) {
    return;
  }
  activeRuntime.stop();
  activeRuntime = null;
}

export async function recordAutomaticCharacterEdit(
  character: AutomaticSyncLocalCharacter
): Promise<'queued' | 'local-only'> {
  if (!activeRuntime) return 'local-only';
  const result = await activeRuntime.recordEdit(character);
  if (result === 'queued') await activeRuntime.wake();
  return result;
}

export async function recordAutomaticCharacterDelete(
  character: AutomaticSyncLocalCharacter
): Promise<'queued' | 'local-only'> {
  if (!activeRuntime) return 'local-only';
  const result = await activeRuntime.recordDelete(character);
  if (result === 'queued') await activeRuntime.wake();
  return result;
}

export async function wakeAutomaticCharacterSyncRuntime(): Promise<void> {
  await activeRuntime?.wake();
}
