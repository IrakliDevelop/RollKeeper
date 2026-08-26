export function isIndexedDbMigrationEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INDEXEDDB_MIGRATION_ENABLED === 'true';
}

interface PersistenceBootstrapOptions<T> {
  enabled: boolean;
  migrate: (namespace: 'guest') => Promise<T>;
  hydrate: () => Promise<void>;
}

export async function runPersistenceBootstrap<T>(
  options: PersistenceBootstrapOptions<T>
): Promise<
  | T
  | { state: 'LEGACY_PRIMARY'; authority: 'localStorage'; error: string }
  | null
> {
  if (!options.enabled) return null;
  let migrationResult:
    | T
    | { state: 'LEGACY_PRIMARY'; authority: 'localStorage'; error: string };
  try {
    // Authentication never selects or claims a namespace during Slice 7.
    migrationResult = await options.migrate('guest');
  } catch (cause) {
    migrationResult = {
      state: 'LEGACY_PRIMARY',
      authority: 'localStorage',
      error: cause instanceof Error ? cause.message : String(cause),
    };
  }
  await options.hydrate();
  return migrationResult;
}
