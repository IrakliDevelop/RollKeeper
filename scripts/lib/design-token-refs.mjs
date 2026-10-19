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
// sees the literal source text. This is an allow-list on purpose: any
// `word:${` would also match template keys such as `campaign:${code}`.
// The utility checks above never look at variants, so a variant missing here
// only means a glued interpolation goes unreported.
const STATE_VARIANTS = [
  // pseudo-classes
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
  'default',
  'optional',
  'required',
  'invalid',
  'valid',
  'user-valid',
  'user-invalid',
  'in-range',
  'out-of-range',
  'read-only',
  'placeholder-shown',
  'autofill',
  'first',
  'last',
  'only',
  'odd',
  'even',
  'first-of-type',
  'last-of-type',
  'only-of-type',
  'empty',
  'open',
  'popover-open',
  'inert',
  // pseudo-elements
  'before',
  'after',
  'placeholder',
  'selection',
  'marker',
  'file',
  'first-letter',
  'first-line',
  'backdrop',
  'details-content',
  // media and feature queries
  'dark',
  'motion-safe',
  'motion-reduce',
  'print',
  'portrait',
  'landscape',
  'contrast-more',
  'contrast-less',
  'forced-colors',
  'inverted-colors',
  'pointer-fine',
  'pointer-coarse',
  'pointer-none',
  'any-pointer-fine',
  'any-pointer-coarse',
  'any-pointer-none',
  'noscript',
  'scripting-none',
  'scripting-enabled',
  'scripting-initial-only',
  'starting',
  'rtl',
  'ltr',
].join('|');

const ARBITRARY = '\\[[^\\]]+\\]';

const DYNAMIC_VARIANT = new RegExp(
  [
    '(?<![\\w-])(?:',
    // group-*, peer-*, with optional arbitrary value and /name
    '(?:group|peer)(?:-[a-z]+)*(?:-\\[[^\\]]+\\])?(?:/[\\w-]+)?',
    `|(?:not-|in-)?(?:${STATE_VARIANTS})`,
    '|(?:max-)?(?:sm|md|lg|xl|2xl)',
    // aria-*, data-*, has-*, supports-*, not-*, in-*, nth-*, min-*, max-*
    `|(?:aria|data|has|supports|not|in|nth|min|max)-(?:[a-z0-9+-]*${ARBITRARY}|[a-z0-9+-]+)`,
    // container queries: @md:, @max-lg:, @min-[400px]:
    `|@(?:min-|max-)?(?:[23]?xs|sm|md|lg|xl|[2-7]xl|${ARBITRARY})(?:/[\\w-]+)?`,
    // child selectors: *: and **:
    '|\\*{1,2}',
    // arbitrary variants: [&:hover]:, [&>svg]:, [@media(min-width:640px)]:
    '|\\[[&@](?:[^\\[\\]]|\\[[^\\]]*\\])*\\]',
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
