export function isMagicItemServerEnabled(): boolean {
  return process.env.SUPABASE_MAGIC_ITEM_SYNC_ENABLED === 'true';
}

export function isMagicItemClientVisible(): boolean {
  return process.env.NEXT_PUBLIC_MAGIC_ITEM_SYNC_VISIBLE === 'true';
}
