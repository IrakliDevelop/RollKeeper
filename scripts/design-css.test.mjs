import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  FELT_SELECTOR,
  PAPER_SELECTOR,
  SHARED_SELECTOR,
  readBlock,
  stripComments,
} from './design-contrast.mjs';
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

test('toast countdown keyframes ship with the stylesheet', async () => {
  const output = await buildCss([]);
  assert.match(
    output,
    /@keyframes toast-countdown\s*\{\s*from\s*\{\s*transform:\s*scaleX\(1\)/
  );
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
  assert.equal(readBlock(css, PAPER_SELECTOR)['--surface-elevated'], '#fbfbf8');
  assert.equal(readBlock(css, FELT_SELECTOR)['--surface-elevated'], '#1f2b25');
  const output = await buildCss(['bg-surface-elevated']);
  assert.match(
    ruleFor(output, '.bg-surface-elevated'),
    /background-color:\s*var\(--surface-elevated\)/
  );
});

test('shadow-overlay is the one floating-layer shadow, per theme', async () => {
  const css = await readGlobalsCss();
  assert.match(
    readBlock(css, PAPER_SELECTOR)['--overlay-shadow'],
    /rgb\(28 36 32 \/ 0\.16\)/
  );
  assert.match(
    readBlock(css, FELT_SELECTOR)['--overlay-shadow'],
    /rgb\(0 0 0 \/ 0\.5\)/
  );
  const output = await buildCss(['shadow-overlay']);
  assert.match(
    ruleFor(output, '.shadow-overlay'),
    /--tw-shadow:\s*var\(--overlay-shadow\)/
  );
});

test('native controls follow the theme through color-scheme', async () => {
  const css = await readGlobalsCss();
  const scheme = selector =>
    stripComments(css)
      .slice(stripComments(css).indexOf(`${selector} {`))
      .match(/color-scheme:\s*(\w+)/)?.[1];
  assert.equal(scheme(PAPER_SELECTOR), 'light');
  assert.equal(scheme(FELT_SELECTOR), 'dark');
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
  const shared = readBlock(await readGlobalsCss(), SHARED_SELECTOR);
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
  for (const selector of [PAPER_SELECTOR, FELT_SELECTOR]) {
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
  for (const selector of [PAPER_SELECTOR, FELT_SELECTOR]) {
    const names = Object.keys(readBlock(css, selector));
    assert.deepEqual(
      names.filter(name => /^--(accent|gradient)-/.test(name)),
      [],
      `${selector} still declares legacy literals`
    );
  }
});

test('gradient endpoints are flattened to surfaces', async () => {
  const shared = readBlock(await readGlobalsCss(), SHARED_SELECTOR);
  for (const stop of ['from', 'via', 'to']) {
    assert.equal(shared[`--gradient-page-${stop}`], 'var(--background)');
  }
  assert.equal(shared['--gradient-purple-from'], 'var(--lapis-bg)');
});

test('parchment is retired: paper and felt are the only theme blocks', async () => {
  const css = stripComments(await readGlobalsCss());
  const themed = new Set(
    [...css.matchAll(/\[data-theme=['"]?([\w-]+)['"]?\]/g)].map(
      match => match[1]
    )
  );
  assert.deepEqual([...themed].sort(), ['dark', 'light']);
  assert.doesNotMatch(css, /parchment/i);
});

test('no theme block redeclares a shared token', async () => {
  // Shared tokens are declared once on `:root, [data-theme]` so they
  // re-resolve in nested theme wrappers. A literal in a theme block would
  // either be dead (paper sits before the shared block) or win over it
  // (felt sits after), splitting the themes.
  const css = await readGlobalsCss();
  const shared = Object.keys(readBlock(css, SHARED_SELECTOR));
  for (const name of ['--background', '--foreground', '--ring', '--input-bg']) {
    assert.ok(
      shared.includes(name),
      `${name} must be declared on :root, [data-theme]`
    );
  }
  for (const selector of [PAPER_SELECTOR, FELT_SELECTOR]) {
    const block = readBlock(css, selector);
    assert.deepEqual(
      shared.filter(name => name in block),
      [],
      `${selector} redeclares shared tokens`
    );
  }
});

test('Storybook takes its theme colours from the tokens', async () => {
  const preview = await readFile(
    path.join(repositoryRoot, '.storybook/preview.tsx'),
    'utf8'
  );
  assert.doesNotMatch(preview, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(preview, /parchment/i);
  assert.doesNotMatch(preview, /document\.body\.style/);
  assert.match(preview, /var\(--background\)/);

  // `ruleFor` finds the first substring match ("body-family" in the theme
  // tokens), so read the `body` rule from the source instead.
  const css = stripComments(await readGlobalsCss());
  const body = css.match(/(^|\n)body\s*\{([^}]*)\}/)?.[2] ?? '';
  assert.match(body, /background:\s*var\(--background\)/);
  assert.match(body, /color:\s*var\(--foreground\)/);
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

test('a light wrapper inside a felt page re-declares every paper literal', async () => {
  // Custom properties inherit, so without [data-theme='light'] on the paper
  // block a light wrapper inside <html data-theme="dark"> would keep felt.
  const css = await readGlobalsCss();
  assert.match(
    stripComments(css),
    /:root,\s*\[data-theme='light'\]\s*\{\s*color-scheme:\s*light/
  );
  const paper = Object.keys(readBlock(css, PAPER_SELECTOR));
  const felt = Object.keys(readBlock(css, FELT_SELECTOR));
  assert.deepEqual(
    felt.filter(name => !paper.includes(name)),
    [],
    'felt declares literals the paper block lacks'
  );
});

test('number fields hide their spin buttons', async () => {
  const output = await buildCss([]);
  // [^}]*? and the lookbehind let a prefixed -webkit-/-moz-appearance line
  // come first without matching it as the unprefixed one.
  assert.match(
    output,
    /input\[type=['"]?number['"]?\]\s*\{[^}]*?(?<![\w-])appearance:\s*textfield/
  );
  assert.match(
    output,
    /input\[type=['"]?number['"]?\]::-webkit-inner-spin-button,\s*input\[type=['"]?number['"]?\]::-webkit-outer-spin-button\s*\{[^}]*?(?<![\w-])appearance:\s*none;[^}]*?margin:\s*0/
  );
});

test('scrollbar-thin draws a thin native scrollbar', async () => {
  const output = await buildCss(['scrollbar-thin']);
  assert.match(output, /\.scrollbar-thin\s*\{\s*scrollbar-width:\s*thin;\s*\}/);
});

test('scrollbar-hide hides the scrollbar in every engine', async () => {
  const output = await buildCss(['scrollbar-hide']);
  assert.match(
    output,
    /\.scrollbar-hide\s*\{\s*scrollbar-width:\s*none;\s*&::-webkit-scrollbar\s*\{\s*display:\s*none;/
  );
});

test('Radix Dialog and Popover stay pinned to the same exact version', async () => {
  // The anchored editor opens popovers inside dialogs; mismatched versions
  // make a nested popover close itself.
  const read = async file =>
    JSON.parse(await readFile(path.join(repositoryRoot, file), 'utf8'));
  const pkg = await read('package.json');
  const lock = await read('package-lock.json');
  const dialog = pkg.dependencies['@radix-ui/react-dialog'];
  assert.match(dialog, /^\d+\.\d+\.\d+$/, 'exact pin, no range');
  assert.equal(pkg.dependencies['@radix-ui/react-popover'], dialog);
  const version = name => lock.packages[`node_modules/${name}`]?.version;
  assert.equal(version('@radix-ui/react-dialog'), dialog);
  assert.equal(version('@radix-ui/react-popover'), dialog);
});
