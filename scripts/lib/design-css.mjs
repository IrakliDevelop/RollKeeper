import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { compile } from '@tailwindcss/node';

import { repositoryRoot } from './design-source.mjs';

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
