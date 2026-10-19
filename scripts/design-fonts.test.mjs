import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { PAPER_SELECTOR, readBlock } from './design-contrast.mjs';
import { buildCss, ruleFor } from './lib/design-css.mjs';
import {
  readGlobalsCss,
  readSourceFiles,
  repositoryRoot,
} from './lib/design-source.mjs';

const appDir = path.join(repositoryRoot, 'src', 'app');

const FONT_FILES = [
  'barlow-condensed-latin-600-normal.woff2',
  'barlow-condensed-latin-700-normal.woff2',
  'barlow-latin-400-italic.woff2',
  'barlow-latin-400-normal.woff2',
  'barlow-latin-500-normal.woff2',
  'barlow-latin-600-normal.woff2',
  'vollkorn-latin-wght-normal.woff2',
];

const RETIRED_FONT = /geist|cinzel|bricolage|hanken/i;

test('only the Felt and Brass font files ship', async () => {
  const files = (await readdir(path.join(appDir, 'fonts')))
    .filter(file => file.endsWith('.woff2'))
    .sort();
  assert.deepEqual(files, FONT_FILES);
});

test('the root layout loads every shipped font file', async () => {
  const layout = await readFile(path.join(appDir, 'layout.tsx'), 'utf8');
  for (const file of FONT_FILES) {
    assert.ok(layout.includes(`./fonts/${file}`), `layout misses ${file}`);
  }
});

test('Vollkorn falls back to serif metrics while it loads', async () => {
  const layout = await readFile(path.join(appDir, 'layout.tsx'), 'utf8');
  const vollkorn = layout.match(/const vollkorn = localFont\(\{[\s\S]*?\}\);/);
  assert.ok(vollkorn, 'layout declares vollkorn with localFont');
  assert.match(vollkorn[0], /adjustFontFallback: 'Times New Roman'/);
});

test('font variables are set on <html>, where :root tokens can read them', async () => {
  const layout = await readFile(path.join(appDir, 'layout.tsx'), 'utf8');
  assert.match(layout, /<html[^>]*className=\{FONT_VARIABLES\}/);
  for (const name of ['vollkorn', 'barlow', 'barlowCondensed']) {
    assert.match(
      layout,
      new RegExp(`\\$\\{${name}\\.variable\\}`),
      `FONT_VARIABLES misses ${name}`
    );
  }
  assert.doesNotMatch(layout, /<body[^>]*\.variable/);
});

test('font tokens point at the new families with safe fallbacks', async () => {
  const root = readBlock(await readGlobalsCss(), PAPER_SELECTOR);
  assert.match(root['--font-body-family'], /^var\(--font-barlow, 'Barlow'\)/);
  assert.match(
    root['--font-display-family'],
    /^var\(--font-barlow-condensed, 'Barlow Condensed'\)/
  );
  assert.match(
    root['--font-heading-family'],
    /^var\(--font-vollkorn, 'Vollkorn'\)/
  );
});

test('font utilities resolve to the family tokens', async () => {
  const output = await buildCss([
    'font-sans',
    'font-heading',
    'font-display',
    'font-mono',
  ]);
  assert.match(
    ruleFor(output, '.font-sans'),
    /font-family:\s*var\(--font-body-family\)/
  );
  assert.match(
    ruleFor(output, '.font-heading'),
    /font-family:\s*var\(--font-heading-family\)/
  );
  assert.match(
    ruleFor(output, '.font-display'),
    /font-family:\s*var\(--font-display-family\)/
  );
  assert.match(ruleFor(output, '.font-mono'), /font-family:\s*ui-monospace/);
});

test('no stylesheet or source file references a retired font', async () => {
  assert.doesNotMatch(await readGlobalsCss(), RETIRED_FONT);
  const offenders = (await readSourceFiles())
    .filter(({ text }) => RETIRED_FONT.test(text))
    .map(({ path: file }) => file);
  assert.deepEqual(offenders, []);
});
