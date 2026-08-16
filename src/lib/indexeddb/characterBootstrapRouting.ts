export type PersistenceBootstrapMode = 'legacy' | 'slice7' | 'character';

export function resolvePersistenceBootstrapMode(options: {
  characterParticipant: boolean;
  slice7Enabled: boolean;
}): PersistenceBootstrapMode {
  if (options.characterParticipant) return 'character';
  if (options.slice7Enabled) return 'slice7';
  return 'legacy';
}
