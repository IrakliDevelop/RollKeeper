import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCounts,
  compareToBaseline,
  formatReport,
  PATTERNS,
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
