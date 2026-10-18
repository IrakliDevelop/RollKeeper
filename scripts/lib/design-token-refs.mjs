// Static checks that every semantic Tailwind class and CSS variable a
// component references is actually defined in src/app/globals.css.
// Undefined tokens fail silently in the browser (transparent backgrounds,
// borders falling back to the text colour), so they are caught here.

const SEMANTIC_UTILITY =
  /(?<![\w-])(?:[\w-]+:)*(?:bg|text|border(?:-[trblxy])?|divide|ring|ring-offset|outline|fill|stroke|from|via|to|placeholder|decoration|caret)-((?:surface|heading|body|muted|faint|divider|inverse|input|foreground|background|accent)[a-z0-9-]*?)(?:\/\d+)?(?![\w-])/g;

const VARIABLE_REFERENCE =
  /\[var\((--[\w-]+)\)|\[(--[\w-]+)\]|-\((--[\w-]+)\)/g;

const V3_BRACKET_VARIABLE = /\[--[\w-]+\]/g;

const DYNAMIC_VARIANT =
  /(?<![\w-])(?:hover|focus|active|group-hover|group-focus-within|focus-visible|focus-within|disabled|dark|sm|md|lg|xl|2xl|peer-[a-z-]+|aria-[a-z-]+|data-\[[^\]]+\]):\$\{/g;

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

export function findTokenProblems(files, css) {
  const variables = definedVariables(css);
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
