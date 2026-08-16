import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fingerprintLocalSupabase,
  resetLocalSupabase,
} from './local-supabase-replay.mjs';

test('resetting and replaying local migrations is deterministic and idempotent', () => {
  resetLocalSupabase();
  const firstReplay = fingerprintLocalSupabase();

  resetLocalSupabase();
  const secondReplay = fingerprintLocalSupabase();

  assert.deepEqual(secondReplay, firstReplay);
  assert.deepEqual(secondReplay.migrations, [
    '20260816000100',
    '20260816000200',
    '20260816000300',
  ]);
});
