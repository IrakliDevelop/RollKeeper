// WCAG contrast check for the Felt and Brass palette. Reads the real theme
// blocks in src/app/globals.css and fails if any required pairing drops
// below its minimum ratio (4.5:1 text, 3:1 non-text marks).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { readGlobalsCss } from './lib/design-source.mjs';

const TEXT = 4.5;
const NON_TEXT = 3;

// Surfaces text and marks are expected to sit on. surface-hover is only
// required for the main text colours, because only rows hover.
const SURFACES = [
  'background',
  'surface-secondary',
  'surface-raised',
  'surface-elevated',
  'surface-inset',
];
const ROLES = ['brass', 'blood', 'verdigris', 'lapis', 'ember', 'frost'];

function pairs() {
  const list = [];
  const add = (foreground, background, min) =>
    list.push({ foreground, background, min });
  for (const surface of SURFACES) {
    for (const text of ['heading', 'body', 'muted']) add(text, surface, TEXT);
    for (const role of ROLES) {
      add(`${role}-text`, surface, TEXT);
      add(`${role}-fill`, surface, NON_TEXT);
      add(`${role}-border`, surface, NON_TEXT);
    }
    add('input-border', surface, NON_TEXT);
    add('ring', surface, NON_TEXT);
  }
  for (const text of ['heading', 'body']) add(text, 'surface-hover', TEXT);
  for (const role of ROLES) add(`${role}-text`, `${role}-bg`, TEXT);
  // Deprecated accent bridge: bg-accent-*-bg-strong behind role text.
  for (const role of ['verdigris', 'blood', 'lapis', 'ember']) {
    add(`${role}-text`, `bridge-${role}-bg-strong`, TEXT);
  }
  // bg-accent-*-text text-inverse badges and buttons.
  for (const role of ROLES) add('inverse', `${role}-text`, TEXT);
  add('on-brass', 'brass-fill', TEXT);
  add('on-blood', 'blood-fill', TEXT);
  add('input-text', 'input-bg', TEXT);
  add('input-placeholder', 'input-bg', TEXT);
  return list;
}

export const PAIRS = pairs();

// The theme blocks that define each palette, in cascade order.
export const THEMES = {
  paper: [':root', ':root,\n[data-theme]'],
  felt: [':root', ':root,\n[data-theme]', "[data-theme='dark']"],
};

export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Declarations of every block whose selector is exactly `selector`, merged
// in source order (later declarations win, as in the cascade).
export function readBlock(css, selector) {
  const source = stripComments(css);
  const declarations = {};
  let found = false;
  let start = source.indexOf(`${selector} {`);
  while (start !== -1) {
    found = true;
    const open = start + selector.length + 2;
    const close = source.indexOf('}', open);
    for (const part of source.slice(open, close).split(';')) {
      const match = part.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
      if (match) declarations[match[1]] = match[2].replace(/\s+/g, ' ');
    }
    start = source.indexOf(`${selector} {`, close);
  }
  if (!found) throw new Error(`No "${selector}" block in globals.css`);
  return declarations;
}

export function themeVariables(css, selectors) {
  return Object.assign({}, ...selectors.map(s => readBlock(css, s)));
}

// Resolves a token to [r, g, b] (0-255). Supports hex and var() chains.
export function resolveColor(variables, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular reference at ${name}`);
  seen.add(name);
  const value = variables[`--${name}`];
  if (value === undefined) throw new Error(`--${name} is not defined`);
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  if (reference) return resolveColor(variables, reference[1], seen);
  const hex = value.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!hex) throw new Error(`--${name}: unsupported colour "${value}"`);
  const digits =
    hex[1].length === 3 ? [...hex[1]].map(d => d + d).join('') : hex[1];
  return [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16));
}

function luminance(rgb) {
  const [r, g, b] = rgb.map(channel => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

export function checkContrast(css, pairList = PAIRS, themes = THEMES) {
  const failures = [];
  for (const [theme, selectors] of Object.entries(themes)) {
    const variables = themeVariables(css, selectors);
    for (const { foreground, background, min } of pairList) {
      const ratio = contrastRatio(
        resolveColor(variables, foreground),
        resolveColor(variables, background)
      );
      if (ratio < min) {
        failures.push({ theme, foreground, background, ratio, min });
      }
    }
  }
  return failures;
}

export function formatFailures(failures) {
  if (failures.length === 0) {
    return `Design contrast: OK (${PAIRS.length} pairings per theme)`;
  }
  return [
    'Design contrast: these pairings are below WCAG AA:',
    ...failures.map(
      ({ theme, foreground, background, ratio, min }) =>
        `  ${theme}: ${foreground} on ${background} ${ratio.toFixed(2)}:1 (needs ${min}:1)`
    ),
  ].join('\n');
}

async function main() {
  const failures = checkContrast(await readGlobalsCss());
  console.log(formatFailures(failures));
  if (failures.length > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
