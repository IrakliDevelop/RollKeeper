import assert from 'node:assert/strict';
import test from 'node:test';

import { readGlobalsCss } from './lib/design-source.mjs';

import {
  PAIRS,
  checkContrast,
  contrastRatio,
  formatFailures,
  readBlock,
  resolveColor,
} from './design-contrast.mjs';

const css = `
:root {
  --page: #ffffff; /* white */
  --ink: #000000;
  --grey: #777777;
  --alias: var(--ink);
}
[data-theme='dark'] {
  --page: #000000;
  --ink: #ffffff;
}
`;

const themes = {
  light: [':root'],
  dark: [':root', "[data-theme='dark']"],
};

test('computes WCAG ratios', () => {
  assert.equal(contrastRatio([0, 0, 0], [255, 255, 255]), 21);
  assert.equal(contrastRatio([255, 255, 255], [255, 255, 255]), 1);
  assert.equal(
    contrastRatio([0x77, 0x77, 0x77], [255, 255, 255]).toFixed(2),
    '4.48'
  );
});

test('reads declarations from one block, ignoring comments', () => {
  assert.deepEqual(readBlock(css, "[data-theme='dark']"), {
    '--page': '#000000',
    '--ink': '#ffffff',
  });
  assert.equal(readBlock(css, ':root')['--page'], '#ffffff');
});

test('merges repeated blocks with the same selector in order', () => {
  const repeated =
    ':root {\n  --a: #000000;\n}\n:root {\n  --a: #ffffff;\n  --b: #111111;\n}';
  assert.deepEqual(readBlock(repeated, ':root'), {
    '--a': '#ffffff',
    '--b': '#111111',
  });
  assert.throws(() => readBlock(repeated, '.missing'), /No "\.missing" block/);
});

test('resolves var() chains and short hex', () => {
  assert.deepEqual(
    resolveColor({ '--a': 'var(--b)', '--b': '#fff' }, 'a'),
    [255, 255, 255]
  );
});

test('rejects undefined, circular and unsupported tokens', () => {
  assert.throws(() => resolveColor({}, 'missing'), /--missing is not defined/);
  assert.throws(
    () => resolveColor({ '--a': 'var(--b)', '--b': 'var(--a)' }, 'a'),
    /Circular/
  );
  assert.throws(
    () => resolveColor({ '--a': 'rgba(0, 0, 0, 0.5)' }, 'a'),
    /unsupported colour/
  );
});

test('later theme blocks override earlier ones', () => {
  const pairs = [{ foreground: 'alias', background: 'page', min: 4.5 }];
  assert.deepEqual(checkContrast(css, pairs, themes), []);
});

test('reports each pairing below its minimum', () => {
  // #777 is 4.48:1 on white (fails) and 4.69:1 on black (passes).
  const pairs = [{ foreground: 'grey', background: 'page', min: 4.5 }];
  const failures = checkContrast(css, pairs, themes);
  assert.deepEqual(
    failures.map(({ theme, ratio }) => [theme, ratio.toFixed(2)]),
    [['light', '4.48']]
  );
  assert.match(
    formatFailures(failures),
    /light: grey on page 4\.48:1 \(needs 4\.5:1\)/
  );
});

test('the shipped felt and paper palettes pass WCAG AA', async () => {
  assert.deepEqual(checkContrast(await readGlobalsCss()), []);
});

test('checks bridged accent backgrounds and inverse text on role text', () => {
  const has = (foreground, background, min) =>
    PAIRS.some(
      pair =>
        pair.foreground === foreground &&
        pair.background === background &&
        pair.min === min
    );
  for (const role of ['verdigris', 'blood', 'lapis', 'ember']) {
    assert.ok(
      has(`${role}-text`, `bridge-${role}-bg-strong`, 4.5),
      `${role}-text on bridge-${role}-bg-strong`
    );
  }
  for (const role of [
    'brass',
    'blood',
    'verdigris',
    'lapis',
    'ember',
    'frost',
  ]) {
    assert.ok(has('inverse', `${role}-text`, 4.5), `inverse on ${role}-text`);
  }
  assert.equal(PAIRS.length, 137);
});
