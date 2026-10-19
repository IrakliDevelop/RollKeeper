// Static checks that every semantic Tailwind class and CSS variable a
// component references is actually defined in src/app/globals.css.
// Undefined tokens fail silently in the browser (transparent backgrounds,
// borders falling back to the text colour), so they are caught here.

const SEMANTIC_UTILITY =
  /(?<![\w-])(?:[\w-]+:)*(?:bg|text|border(?:-[trblxy])?|divide|ring|ring-offset|outline|fill|stroke|from|via|to|placeholder|decoration|caret)-((?:surface|heading|body|muted|faint|divider|inverse|input|foreground|background|accent|brass|blood|verdigris|lapis|ember|frost|on-brass|on-blood)[a-z0-9-]*?)(?:\/\d+)?(?![\w-])/g;

// `[var(--x)]`, `[var(--x, fallback)]`, v3 `[--x]` and v4 `-(--x)`.
const VARIABLE_REFERENCE =
  /\[var\((--[\w-]+)\s*[,)]|\[(--[\w-]+)\]|-\((--[\w-]+)\)/g;

// A quoted variable name, e.g. style.setProperty('--dm-vtt-panel-top', …)
// or style={{ '--x': … }}: the variable is defined at runtime by our code.
const RUNTIME_VARIABLE_DEFINITION = /['"`](--[\w-]+)['"`]/g;

const V3_BRACKET_VARIABLE = /\[--[\w-]+\]/g;

// Tailwind variants a class can start with. A variant glued to an
// interpolation (`hover:${x}`) never generates CSS, because Tailwind only
// sees the literal source text.
const STATE_VARIANTS = [
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'visited',
  'target',
  'disabled',
  'enabled',
  'checked',
  'indeterminate',
  'required',
  'invalid',
  'valid',
  'read-only',
  'placeholder',
  'placeholder-shown',
  'first',
  'last',
  'only',
  'odd',
  'even',
  'first-of-type',
  'last-of-type',
  'empty',
  'open',
  'selection',
  'marker',
  'file',
  'before',
  'after',
  'backdrop',
  'dark',
  'motion-safe',
  'motion-reduce',
  'print',
  'portrait',
  'landscape',
  'contrast-more',
  'forced-colors',
  'pointer-fine',
  'pointer-coarse',
  'any-pointer-fine',
  'any-pointer-coarse',
  'starting',
  'inert',
  'rtl',
  'ltr',
].join('|');

const DYNAMIC_VARIANT = new RegExp(
  [
    '(?<![\\w-])(?:',
    // group-*, peer-*, with optional arbitrary value and /name
    '(?:group|peer)(?:-[a-z]+)*(?:-\\[[^\\]]+\\])?(?:/[\\w-]+)?',
    `|(?:not-|in-)?(?:${STATE_VARIANTS})`,
    '|(?:max-)?(?:sm|md|lg|xl|2xl)',
    // aria-*, data-*, has-*, supports-*, not-*, in-*, nth-*, min-*, max-*
    '|(?:aria|data|has|supports|not|in|nth|min|max)-(?:[a-z-]+|\\[[^\\]]+\\])',
    '):\\$\\{',
  ].join(''),
  'g'
);

// Variables set at runtime by libraries, not by globals.css.
const RUNTIME_VARIABLE_PREFIXES = ['--radix-', '--tw-'];

function definedVariables(css) {
  return new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
}

function themeColorNames(css) {
  return new Set(
    [...css.matchAll(/--color-([\w-]+)\s*:/g)].map(match => match[1])
  );
}

function runtimeVariables(files) {
  const names = new Set();
  for (const { text } of files) {
    for (const match of text.matchAll(RUNTIME_VARIABLE_DEFINITION)) {
      names.add(match[1]);
    }
  }
  return names;
}

export function findTokenProblems(files, css) {
  const variables = new Set([
    ...definedVariables(css),
    ...runtimeVariables(files),
  ]);
  const colors = themeColorNames(css);
  const problems = [];
  const report = (file, kind, detail) => {
    if (
      !problems.some(
        problem =>
          problem.file === file &&
          problem.kind === kind &&
          problem.detail === detail
      )
    ) {
      problems.push({ file, kind, detail });
    }
  };

  for (const { path, text } of files) {
    for (const match of text.matchAll(SEMANTIC_UTILITY)) {
      if (!colors.has(match[1])) {
        report(path, 'unknown-utility-token', match[1]);
      }
    }
    for (const match of text.matchAll(VARIABLE_REFERENCE)) {
      const name = match[1] ?? match[2] ?? match[3];
      const isRuntime = RUNTIME_VARIABLE_PREFIXES.some(prefix =>
        name.startsWith(prefix)
      );
      if (!isRuntime && !variables.has(name)) {
        report(path, 'unknown-css-variable', name);
      }
    }
    for (const match of text.matchAll(V3_BRACKET_VARIABLE)) {
      report(path, 'v3-bracket-variable', match[0]);
    }
    for (const match of text.matchAll(DYNAMIC_VARIANT)) {
      report(path, 'dynamic-variant-class', match[0]);
    }
  }
  return problems;
}
