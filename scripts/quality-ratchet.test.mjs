import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessFormatBaseline,
  assessLintBaseline,
} from './quality-ratchet.mjs';

test('lint baseline allows the existing warning count and any improvement', () => {
  assert.deepEqual(assessLintBaseline({ errors: 0, warnings: 69 }, 69), {
    ok: true,
    message: 'ESLint warnings: 69/69 allowed',
  });
  assert.equal(assessLintBaseline({ errors: 0, warnings: 68 }, 69).ok, true);
});

test('lint baseline rejects errors and warning regressions', () => {
  assert.equal(assessLintBaseline({ errors: 1, warnings: 0 }, 69).ok, false);
  assert.equal(assessLintBaseline({ errors: 0, warnings: 70 }, 69).ok, false);
});

test('format baseline allows the existing file count and rejects regressions', () => {
  assert.deepEqual(assessFormatBaseline(273, 273), {
    ok: true,
    message: 'Prettier deviations: 273/273 allowed',
  });
  assert.equal(assessFormatBaseline(272, 273).ok, true);
  assert.equal(assessFormatBaseline(274, 273).ok, false);
});
