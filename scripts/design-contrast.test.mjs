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

test('the shipped paper, felt and blue dark palettes pass WCAG AA', async () => {
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
  assert.ok(
    has('heading', 'bridge-verdigris-bg-strong', 4.5),
    'healthy HP number in the tinted HP box'
  );
  for (const text of ['heading', 'body', 'muted']) {
    assert.ok(has(text, 'brass-bg', 4.5), `${text} on prepared spell rows`);
  }
  assert.equal(PAIRS.length, 146);
});

test('checks selected and danger button text on the hover surface', () => {
  const has = (foreground, background) =>
    PAIRS.some(
      pair =>
        pair.foreground === foreground &&
        pair.background === background &&
        pair.min === 4.5
    );
  assert.ok(has('brass-text', 'surface-hover'), 'brass-text on surface-hover');
  assert.ok(has('blood-text', 'surface-hover'), 'blood-text on surface-hover');
  assert.ok(has('heading', 'ember-bg'), 'heading on ember-bg');
});

test('checks the switch thumb against the unchecked track', () => {
  assert.ok(
    PAIRS.some(
      pair =>
        pair.foreground === 'on-brass' &&
        pair.background === 'input-border' &&
        pair.min === 3
    )
  );
});

test('matches a selector only as a whole rule, not as the tail of a list', () => {
  const nested = [
    '@import "x";',
    ':root,',
    '[data-theme] {',
    '  --shared: #111111;',
    '}',
    'html:root {',
    '  --html: #222222;',
    '}',
    '.card :root {',
    '  --descendant: #333333;',
    '}',
    ':root {',
    '  --own: #444444;',
    '}',
    '@layer base { [data-theme] { --inner: #555555; } }',
  ].join('\n');
  assert.deepEqual(readBlock(nested, ':root'), { '--own': '#444444' });
  assert.deepEqual(readBlock(nested, '[data-theme]'), { '--inner': '#555555' });
  assert.deepEqual(readBlock(nested, ':root,\n[data-theme]'), {
    '--shared': '#111111',
  });
  assert.deepEqual(readBlock(nested, ':root, [data-theme]'), {
    '--shared': '#111111',
  });
  assert.throws(() => readBlock(nested, 'root'), /No "root" block/);
  assert.throws(() => readBlock(nested, '.card'), /No "\.card" block/);
});

test('a selector list is matched exactly, in order', () => {
  const lists = ":root,\n[data-theme='light'] {\n  --a: #fff;\n}";
  assert.deepEqual(readBlock(lists, ":root,\n[data-theme='light']"), {
    '--a': '#fff',
  });
  assert.throws(() => readBlock(lists, ':root'), /No ":root" block/);
  assert.throws(() => readBlock(lists, "[data-theme='light']"), /No "/);
  assert.throws(() => readBlock(lists, "[data-theme='light'],:root"), /No "/);
});

test('checks the menu keyboard outline against the highlighted row', () => {
  assert.ok(
    PAIRS.some(
      pair =>
        pair.foreground === 'ring' &&
        pair.background === 'surface-hover' &&
        pair.min === 3
    )
  );
});
