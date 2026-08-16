revoke all on table public.characters from public, anon, authenticated;
grant select on table public.characters to authenticated;

revoke all on function public.guard_character_identity_and_tombstone()
from public, anon, authenticated;
