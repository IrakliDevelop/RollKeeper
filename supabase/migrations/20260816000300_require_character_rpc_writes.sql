revoke insert, update on table public.characters from authenticated;

drop policy characters_insert_own on public.characters;
drop policy characters_update_own on public.characters;
