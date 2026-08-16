import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  fingerprintLocalSupabase,
  resetLocalSupabase,
} from './local-supabase-replay.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const targetedResetPath = path.join(
  repositoryRoot,
  'supabase',
  'migrations',
  '20260816000000_remove_obsolete_rollkeeper_schema.sql'
);

test('the targeted reset names only audited RollKeeper-owned objects', () => {
  const migration = fs.readFileSync(targetedResetPath, 'utf8');
  const droppedPolicies = [
    ...migration.matchAll(/^\s*\('public', '([a-z_]+)', '([^']+)'\),?$/gm),
  ]
    .map(([, table, policy]) => `public.${table}:${policy}`)
    .sort();
  const droppedObjects = [
    ...migration.matchAll(/^drop (?:table|function) if exists ([^;]+);$/gm),
  ]
    .map(([, object]) => object)
    .sort();

  assert.deepEqual(droppedPolicies, [
    'public.campaign_members:DMs can add members to their campaigns',
    'public.campaign_members:DMs can remove their campaign members',
    'public.campaign_members:DMs can update their campaign members',
    'public.campaign_members:DMs can view their campaign members',
    'public.campaign_members:Users can update their own membership',
    'public.campaign_members:Users can view their own memberships',
    'public.campaigns:Campaign members can view their campaigns',
    'public.campaigns:DMs can create campaigns',
    'public.campaigns:DMs can delete their own campaigns',
    'public.campaigns:DMs can update their own campaigns',
    'public.campaigns:DMs can view their own campaigns',
    'public.character_references:Campaign members can view campaign characters',
    'public.character_references:DMs can remove characters from their campaigns',
    'public.character_references:DMs can view characters in their campaigns',
    'public.character_references:Players can add their own characters',
    'public.character_references:Players can remove their own characters',
    'public.character_references:Players can update their own characters',
    'public.character_references:Players can view their own characters',
    'public.encounter_participants:Campaign members can view visible participants',
    'public.encounter_participants:DMs can add participants to their encounters',
    'public.encounter_participants:DMs can remove participants from their encounters',
    'public.encounter_participants:DMs can update participants in their encounters',
    'public.encounter_participants:DMs can view participants in their encounters',
    'public.encounters:Campaign members can view encounters',
    'public.encounters:DMs can create encounters in their campaigns',
    'public.encounters:DMs can delete their campaign encounters',
    'public.encounters:DMs can update their campaign encounters',
    'public.encounters:DMs can view their campaign encounters',
    'public.user_profiles:All users can view other profiles',
    'public.user_profiles:Users can insert their own profile',
    'public.user_profiles:Users can update their own profile',
    'public.user_profiles:Users can view their own profile',
  ]);
  assert.deepEqual(droppedObjects, [
    'public.campaign_members',
    'public.campaigns',
    'public.character_references',
    'public.encounter_participants',
    'public.encounters',
    'public.generate_invite_code()',
    'public.migrations',
    'public.set_campaign_invite_code()',
    'public.update_updated_at_column()',
    'public.user_profiles',
  ]);
  assert.doesNotMatch(
    migration,
    /\b(?:auth|extensions|realtime|storage|supabase_migrations|vault)\./
  );
  assert.doesNotMatch(migration, /\bcascade\b/i);
});

test('resetting and replaying local migrations is deterministic and idempotent', () => {
  resetLocalSupabase();
  const firstReplay = fingerprintLocalSupabase();

  resetLocalSupabase();
  const secondReplay = fingerprintLocalSupabase();

  assert.deepEqual(secondReplay, firstReplay);
  assert.deepEqual(secondReplay.migrations, [
    '20260816000000',
    '20260816000100',
    '20260816000200',
    '20260816000300',
    '20260816000400',
    '20260816000500',
  ]);
});
