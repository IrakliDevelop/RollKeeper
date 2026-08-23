export function isEncounterServerEnabled(): boolean {
  return process.env.SUPABASE_ENCOUNTER_SYNC_ENABLED === 'true';
}

export function isEncounterClientVisible(): boolean {
  return process.env.NEXT_PUBLIC_ENCOUNTER_SYNC_VISIBLE === 'true';
}
