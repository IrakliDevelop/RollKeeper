export function isCombatLogArchiveServerEnabled() {
  return process.env.SUPABASE_COMBAT_LOG_SYNC_ENABLED === 'true';
}

export function isCombatLogArchiveClientVisible() {
  return process.env.NEXT_PUBLIC_COMBAT_LOG_SYNC_VISIBLE === 'true';
}
