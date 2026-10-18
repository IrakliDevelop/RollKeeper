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
