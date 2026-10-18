import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { compile } from '@tailwindcss/node';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const globalsPath = path.join(repositoryRoot, 'src', 'app', 'globals.css');

// Compiles the real globals.css and generates CSS for the given class names,
// so assertions run against exactly what the app ships.
export async function buildCss(candidates) {
  const css = await readFile(globalsPath, 'utf8');
  const compiler = await compile(css, {
    base: path.dirname(globalsPath),
    onDependency: () => {},
  });
  return compiler.build(candidates);
}

export function ruleFor(output, escapedSelector) {
  const start = output.indexOf(escapedSelector);
  assert.notEqual(start, -1, `expected a rule for ${escapedSelector}`);
  return output.slice(start, output.indexOf('}', start) + 1);
}

test('dark: variant follows the data-theme attribute', async () => {
  const output = await buildCss(['dark:bg-surface']);
  const rule = ruleFor(output, '.dark\\:bg-surface');
  assert.match(rule, /data-theme=dark/);
});

test('dark: variant never follows the OS colour scheme', async () => {
  const output = await buildCss(['dark:bg-surface', 'dark:text-heading']);
  assert.doesNotMatch(output, /prefers-color-scheme:\s*dark/);
});

test('popover-in keyframes ship with the stylesheet', async () => {
  const output = await buildCss(['animate-[popover-in_150ms_ease-out]']);
  assert.match(output, /@keyframes popover-in/);
  assert.match(output, /animation:\s*popover-in 150ms ease-out/);
});

test('enter and exit animation utilities are generated', async () => {
  const output = await buildCss([
    'animate-in',
    'animate-out',
    'fade-in-0',
    'zoom-in-95',
    'slide-in-from-top-[48%]',
  ]);
  for (const selector of [
    '.animate-in',
    '.animate-out',
    '.fade-in-0',
    '.zoom-in-95',
  ]) {
    assert.ok(output.includes(selector), `missing ${selector}`);
  }
});

test('reduced motion shortens every animation and transition', async () => {
  const output = await buildCss([]);
  const start = output.indexOf('prefers-reduced-motion: reduce');
  assert.notEqual(start, -1, 'expected a prefers-reduced-motion block');
  const block = output.slice(start, start + 600);
  assert.match(block, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(block, /transition-duration:\s*0\.01ms\s*!important/);
});

test('surface-elevated resolves through the theme-aware hover token', async () => {
  const output = await buildCss(['bg-surface-elevated']);
  assert.match(output, /--surface-elevated:\s*var\(--surface-hover\)/);
  assert.match(
    ruleFor(output, '.bg-surface-elevated'),
    // @theme inline writes the underlying variable straight into the utility.
    /background-color:\s*var\(--surface-elevated\)/
  );
});
