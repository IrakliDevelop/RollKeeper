import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { readBlock, stripComments } from './design-contrast.mjs';
import { buildCss, ruleFor } from './lib/design-css.mjs';
import { readGlobalsCss, repositoryRoot } from './lib/design-source.mjs';

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

test('reduced motion keeps spinners turning', async () => {
  const output = await buildCss(['animate-spin']);
  const start = output.indexOf('prefers-reduced-motion: reduce');
  assert.notEqual(start, -1, 'expected a prefers-reduced-motion block');
  const block = output.slice(start);
  assert.match(
    block,
    /\.animate-spin\s*\{[^}]*animation-iteration-count:\s*infinite\s*!important/
  );
});

test('surface-elevated has its own felt and paper values', async () => {
  const css = await readGlobalsCss();
  assert.equal(readBlock(css, ':root')['--surface-elevated'], '#fbfbf8');
  assert.equal(
    readBlock(css, "[data-theme='dark']")['--surface-elevated'],
    '#1f2b25'
  );
  const output = await buildCss(['bg-surface-elevated']);
  assert.match(
    ruleFor(output, '.bg-surface-elevated'),
    /background-color:\s*var\(--surface-elevated\)/
  );
});

test('native controls follow the theme through color-scheme', async () => {
  const css = await readGlobalsCss();
  const scheme = selector =>
    stripComments(css)
      .slice(stripComments(css).indexOf(`${selector} {`))
      .match(/color-scheme:\s*(\w+)/)?.[1];
  assert.equal(scheme(':root'), 'light');
  assert.equal(scheme("[data-theme='dark']"), 'dark');
  const declarations = stripComments(css).match(/(?<![\w-])color-scheme:/g);
  assert.equal(declarations.length, 2, 'only paper and felt set color-scheme');
});

test('role utilities are generated from the role tokens', async () => {
  const output = await buildCss([
    'text-brass-text',
    'bg-brass-fill',
    'text-on-brass',
    'border-blood-border',
    'bg-lapis-bg',
  ]);
  assert.match(
    ruleFor(output, '.text-brass-text'),
    /color:\s*var\(--brass-text\)/
  );
  assert.match(
    ruleFor(output, '.bg-brass-fill'),
    /background-color:\s*var\(--brass-fill\)/
  );
  assert.match(ruleFor(output, '.text-on-brass'), /color:\s*var\(--on-brass\)/);
  assert.match(
    ruleFor(output, '.border-blood-border'),
    /border-color:\s*var\(--blood-border\)/
  );
  assert.match(
    ruleFor(output, '.bg-lapis-bg'),
    /background-color:\s*var\(--lapis-bg\)/
  );
});

const BRIDGE = {
  emerald: 'verdigris',
  green: 'verdigris',
  red: 'blood',
  purple: 'lapis',
  violet: 'lapis',
  indigo: 'lapis',
  blue: 'lapis',
  amber: 'ember',
  yellow: 'ember',
  orange: 'ember',
};

test('every deprecated accent token points at its role', async () => {
  const shared = readBlock(await readGlobalsCss(), ':root,\n[data-theme]');
  for (const [hue, role] of Object.entries(BRIDGE)) {
    assert.equal(shared[`--accent-${hue}-text`], `var(--${role}-text)`);
    assert.equal(shared[`--accent-${hue}-text-muted`], `var(--${role}-text)`);
    assert.equal(
      shared[`--accent-${hue}-border`],
      `var(--bridge-${role}-border)`
    );
    assert.equal(
      shared[`--accent-${hue}-border-strong`],
      `var(--${role}-border)`
    );
    assert.equal(shared[`--accent-${hue}-bg`], `var(--${role}-bg)`);
    assert.equal(
      shared[`--accent-${hue}-bg-strong`],
      `var(--bridge-${role}-bg-strong)`
    );
  }
});

test('paper and felt each declare the softer bridge border literals', async () => {
  const css = await readGlobalsCss();
  for (const selector of [':root', "[data-theme='dark']"]) {
    const block = readBlock(css, selector);
    for (const role of ['verdigris', 'blood', 'lapis', 'ember']) {
      assert.match(
        block[`--bridge-${role}-border`] ?? '',
        /^#[0-9a-f]{6}$/,
        `${selector} should declare --bridge-${role}-border as a hex literal`
      );
    }
  }
});

test('felt and paper declare no hue-named accent or gradient literals', async () => {
  const css = await readGlobalsCss();
  for (const selector of [':root', "[data-theme='dark']"]) {
    const names = Object.keys(readBlock(css, selector));
    assert.deepEqual(
      names.filter(name => /^--(accent|gradient)-/.test(name)),
      [],
      `${selector} still declares legacy literals`
    );
  }
});

test('gradient endpoints are flattened to surfaces', async () => {
  const shared = readBlock(await readGlobalsCss(), ':root,\n[data-theme]');
  for (const stop of ['from', 'via', 'to']) {
    assert.equal(shared[`--gradient-page-${stop}`], 'var(--background)');
  }
  assert.equal(shared['--gradient-purple-from'], 'var(--lapis-bg)');
});

test('parchment is retired: paper and felt are the only theme blocks', async () => {
  const css = stripComments(await readGlobalsCss());
  const themed = [...css.matchAll(/\[data-theme='([\w-]+)'\]\s*\{/g)].map(
    match => match[1]
  );
  assert.deepEqual(themed, ['dark']);
  assert.doesNotMatch(css, /parchment/i);
});

test('no theme block redeclares a shared token', async () => {
  // Shared tokens are declared once on `:root, [data-theme]` so they
  // re-resolve in nested theme wrappers. A literal in a theme block would
  // either be dead (paper sits before the shared block) or win over it
  // (felt sits after), splitting the themes.
  const css = await readGlobalsCss();
  const shared = Object.keys(readBlock(css, ':root,\n[data-theme]'));
  for (const selector of [':root', "[data-theme='dark']"]) {
    const block = readBlock(css, selector);
    assert.deepEqual(
      shared.filter(name => name in block),
      [],
      `${selector} redeclares shared tokens`
    );
  }
});

test('@tailwindcss/node is a direct dependency in lockstep with @tailwindcss/postcss', async () => {
  const read = async file =>
    JSON.parse(await readFile(path.join(repositoryRoot, file), 'utf8'));
  const pkg = await read('package.json');
  const lock = await read('package-lock.json');
  assert.equal(
    pkg.devDependencies['@tailwindcss/node'],
    pkg.devDependencies['@tailwindcss/postcss']
  );
  assert.equal(
    lock.packages[''].devDependencies['@tailwindcss/node'],
    pkg.devDependencies['@tailwindcss/node']
  );
  const version = name => lock.packages[`node_modules/${name}`]?.version;
  assert.ok(version('@tailwindcss/node'), 'lockfile has @tailwindcss/node');
  assert.equal(version('@tailwindcss/node'), version('@tailwindcss/postcss'));
});
