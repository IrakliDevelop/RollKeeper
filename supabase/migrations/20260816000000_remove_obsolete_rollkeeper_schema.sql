-- Slice 4 removes only the audited, obsolete RollKeeper application objects.
-- Supabase-managed schemas and infrastructure are intentionally out of scope.

do $$
declare
  audited_policy record;
begin
  for audited_policy in
    select *
    from (
      values
        ('public', 'campaign_members', 'DMs can add members to their campaigns'),
        ('public', 'campaign_members', 'DMs can remove their campaign members'),
        ('public', 'campaign_members', 'DMs can update their campaign members'),
        ('public', 'campaign_members', 'DMs can view their campaign members'),
        ('public', 'campaign_members', 'Users can update their own membership'),
        ('public', 'campaign_members', 'Users can view their own memberships'),
        ('public', 'campaigns', 'Campaign members can view their campaigns'),
        ('public', 'campaigns', 'DMs can create campaigns'),
        ('public', 'campaigns', 'DMs can delete their own campaigns'),
        ('public', 'campaigns', 'DMs can update their own campaigns'),
        ('public', 'campaigns', 'DMs can view their own campaigns'),
        ('public', 'character_references', 'Campaign members can view campaign characters'),
        ('public', 'character_references', 'DMs can remove characters from their campaigns'),
        ('public', 'character_references', 'DMs can view characters in their campaigns'),
        ('public', 'character_references', 'Players can add their own characters'),
        ('public', 'character_references', 'Players can remove their own characters'),
        ('public', 'character_references', 'Players can update their own characters'),
        ('public', 'character_references', 'Players can view their own characters'),
        ('public', 'encounter_participants', 'Campaign members can view visible participants'),
        ('public', 'encounter_participants', 'DMs can add participants to their encounters'),
        ('public', 'encounter_participants', 'DMs can remove participants from their encounters'),
        ('public', 'encounter_participants', 'DMs can update participants in their encounters'),
        ('public', 'encounter_participants', 'DMs can view participants in their encounters'),
        ('public', 'encounters', 'Campaign members can view encounters'),
        ('public', 'encounters', 'DMs can create encounters in their campaigns'),
        ('public', 'encounters', 'DMs can delete their campaign encounters'),
        ('public', 'encounters', 'DMs can update their campaign encounters'),
        ('public', 'encounters', 'DMs can view their campaign encounters'),
        ('public', 'user_profiles', 'All users can view other profiles'),
        ('public', 'user_profiles', 'Users can insert their own profile'),
        ('public', 'user_profiles', 'Users can update their own profile'),
        ('public', 'user_profiles', 'Users can view their own profile')
    ) as policies(schema_name, table_name, policy_name)
  loop
    if to_regclass(
      format('%I.%I', audited_policy.schema_name, audited_policy.table_name)
    ) is not null then
      execute format(
        'drop policy if exists %I on %I.%I',
        audited_policy.policy_name,
        audited_policy.schema_name,
        audited_policy.table_name
      );
    end if;
  end loop;
end
$$;

drop table if exists public.encounter_participants;
drop table if exists public.encounters;
drop table if exists public.character_references;
drop table if exists public.campaign_members;
drop table if exists public.campaigns;
drop table if exists public.user_profiles;
drop table if exists public.migrations;

drop function if exists public.set_campaign_invite_code();
drop function if exists public.generate_invite_code();
drop function if exists public.update_updated_at_column();
