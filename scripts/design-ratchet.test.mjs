import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ALLOWLIST,
  collectCounts,
  compareToBaseline,
  formatReport,
  MISSING_BASELINE_HINT,
  PATTERNS,
  runRatchet,
} from './design-ratchet.mjs';

const count = (text, file = 'src/a.tsx') =>
  collectCounts([{ path: file, text }], PATTERNS, {});

test('counts each legacy pattern per file', () => {
  const counts = count(
    [
      'bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600',
      'hover:scale-105 group-hover:-translate-y-1 active:scale-95',
      'shadow-lg md:shadow-2xl shadow-sm',
      'backdrop-blur-sm',
      'text-accent-purple-text bg-purple-500 text-gray-800',
      'uppercase tracking-wide',
      "import { Sparkles, X } from 'lucide-react';",
      '<input type="number" />',
    ].join('\n')
  );
  assert.deepEqual(counts, {
    gradient: { 'src/a.tsx': 1 },
    'gradient-stop': { 'src/a.tsx': 2 },
    'hover-motion': { 'src/a.tsx': 3 },
    'large-shadow': { 'src/a.tsx': 2 },
    'backdrop-blur': { 'src/a.tsx': 1 },
    'accent-hue': { 'src/a.tsx': 1 },
    'raw-hue': { 'src/a.tsx': 5 },
    uppercase: { 'src/a.tsx': 1 },
    sparkles: { 'src/a.tsx': 1 },
    'number-input': { 'src/a.tsx': 1 },
  });
});

test('does not count animation utilities as gradient stops', () => {
  assert.deepEqual(count('slide-in-from-top-[48%] fade-in-0 zoom-in-95'), {});
});

test('allow-listed files are skipped for their pattern only', () => {
  const counts = collectCounts(
    [{ path: 'src/utils/hpColor.ts', text: 'bg-red-500 uppercase' }],
    PATTERNS,
    { 'raw-hue': ['src/utils/hpColor.ts'] }
  );
  assert.deepEqual(counts, { uppercase: { 'src/utils/hpColor.ts': 1 } });
});

test('counts shadow-overlay outside the floating-layer primitives', () => {
  assert.deepEqual(count('shadow-overlay hover:shadow-overlay shadow-md'), {
    'overlay-shadow': { 'src/a.tsx': 2 },
  });
  assert.deepEqual(count('shadow-overlay-soft'), {});
});

test('the floating-layer primitives may use shadow-overlay', () => {
  const files = [
    'src/components/ui/primitives/variants.ts',
    'src/components/ui/feedback/SideDrawer.tsx',
  ].map(file => ({ path: file, text: 'border shadow-overlay' }));
  assert.deepEqual(collectCounts(files, PATTERNS, ALLOWLIST), {});
});

test('reports per-file regressions and improvements', () => {
  const baseline = { gradient: { 'src/a.tsx': 2, 'src/b.tsx': 1 } };
  const current = { gradient: { 'src/a.tsx': 1, 'src/b.tsx': 2 } };
  assert.deepEqual(compareToBaseline(current, baseline), {
    regressions: [{ pattern: 'gradient', file: 'src/b.tsx', was: 1, now: 2 }],
    improvements: [{ pattern: 'gradient', file: 'src/a.tsx', was: 2, now: 1 }],
  });
});

test('a moved file shows as a regression with guidance', () => {
  const result = compareToBaseline(
    { gradient: { 'src/new/a.tsx': 1 } },
    { gradient: { 'src/old/a.tsx': 1 } }
  );
  assert.equal(result.regressions.length, 1);
  const report = formatReport(result);
  assert.match(report, /src\/new\/a\.tsx/);
  assert.match(report, /moved or renamed/);
  assert.match(report, /npm run design:baseline -- --force/);
});

test('a clean comparison produces an OK report', () => {
  assert.match(
    formatReport({ regressions: [], improvements: [] }),
    /Design ratchet: OK/
  );
});

const fakeFiles = async () => [{ path: 'src/a.tsx', text: 'uppercase' }];

async function withTempBaseline(contents, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'design-ratchet-'));
  const file = path.join(dir, 'baseline.json');
  if (contents !== undefined) await writeFile(file, contents);
  try {
    return await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('a missing baseline fails the check with a one-line hint', async () => {
  await withTempBaseline(undefined, async file => {
    const result = await runRatchet({ file, readFiles: fakeFiles });
    assert.equal(result.exitCode, 1);
    assert.equal(result.stderr, MISSING_BASELINE_HINT);
    assert.equal(result.stderr.split('\n').length, 1);
    assert.equal(result.stdout, '');
  });
});

test('the first baseline is created without --force', async () => {
  await withTempBaseline(undefined, async file => {
    const result = await runRatchet({
      mode: 'update',
      file,
      readFiles: fakeFiles,
    });
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /created/);
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), {
      uppercase: { 'src/a.tsx': 1 },
    });
  });
});

test('raising an existing baseline still needs --force', async () => {
  await withTempBaseline('{}\n', async file => {
    const refused = await runRatchet({
      mode: 'update',
      file,
      readFiles: fakeFiles,
    });
    assert.equal(refused.exitCode, 1);
    assert.match(refused.stderr, /Refusing to raise the baseline/);
    const forced = await runRatchet({
      mode: 'update',
      flags: ['--force'],
      file,
      readFiles: fakeFiles,
    });
    assert.equal(forced.exitCode, 0);
  });
});

test('a malformed baseline is an error, not an empty baseline', async () => {
  await withTempBaseline('{ not json', async file => {
    await assert.rejects(
      runRatchet({ file, readFiles: fakeFiles }),
      SyntaxError
    );
  });
});
