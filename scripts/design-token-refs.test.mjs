import assert from 'node:assert/strict';
import test from 'node:test';

import { readGlobalsCss, readSourceFiles } from './lib/design-source.mjs';
import { findTokenProblems } from './lib/design-token-refs.mjs';

const css = `
:root { --surface: #fff; --divider: #ccc; }
@theme inline {
  --color-surface: var(--surface);
  --color-divider: var(--divider);
}
`;

const file = text => [{ path: 'src/example.tsx', text }];

test('accepts defined semantic utilities and variables', () => {
  assert.deepEqual(
    findTokenProblems(
      file(
        `<div className="bg-surface border-divider hover:bg-surface/50 divide-(--divider) w-(--radix-select-trigger-width)" />`
      ),
      css
    ),
    []
  );
});

test('flags semantic utilities with no theme token', () => {
  assert.deepEqual(
    findTokenProblems(
      file(`<div className="hover:bg-surface-elevated" />`),
      css
    ),
    [
      {
        file: 'src/example.tsx',
        kind: 'unknown-utility-token',
        detail: 'surface-elevated',
      },
    ]
  );
});

test('flags references to undefined CSS variables', () => {
  const problems = findTokenProblems(
    file(`<div className="divide-[var(--border-divider)]" />`),
    css
  );
  assert.deepEqual(problems, [
    {
      file: 'src/example.tsx',
      kind: 'unknown-css-variable',
      detail: '--border-divider',
    },
  ]);
});

test('flags Tailwind v3 bracket shorthand for variables', () => {
  const problems = findTokenProblems(
    file(`'bg-[--surface] text-heading'`),
    css
  );
  assert.ok(
    problems.some(
      problem =>
        problem.kind === 'v3-bracket-variable' &&
        problem.detail === '[--surface]'
    )
  );
});

test('flags variant prefixes glued to an interpolation', () => {
  const problems = findTokenProblems(
    file('className={`group-hover:${item.accentBorder}`}'),
    css
  );
  assert.deepEqual(problems, [
    {
      file: 'src/example.tsx',
      kind: 'dynamic-variant-class',
      detail: 'group-hover:${',
    },
  ]);
});

test('the repository has no token reference problems', async () => {
  const [files, globals] = await Promise.all([
    readSourceFiles(),
    readGlobalsCss(),
  ]);
  assert.deepEqual(findTokenProblems(files, globals), []);
});
