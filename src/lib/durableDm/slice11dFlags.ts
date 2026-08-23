export function isNpcServerEnabled(): boolean {
  return process.env.SUPABASE_NPC_SYNC_ENABLED === 'true';
}

export function isNpcClientVisible(): boolean {
  return process.env.NEXT_PUBLIC_NPC_SYNC_VISIBLE === 'true';
}
