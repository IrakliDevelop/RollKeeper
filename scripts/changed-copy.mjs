// Lists the user-visible strings a branch adds or changes, so the copy
// review (.claude/skills/rollkeeper-copy) can judge every one of them.
//
//   npm run copy:changed                    # against origin/master
//   npm run copy:changed -- --base feature/felt-and-brass
//   npm run copy:changed -- --json
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import ts from 'typescript';

import { repositoryRoot } from './lib/design-source.mjs';

const SOURCE_FILE = /^src\/.*\.(ts|tsx)$/;
const EXCLUDED_FILE = /(\.test\.|\.stories\.|\/__tests__\/|\.d\.ts$)/;

// JSX props whose string values reach the screen or a screen reader.
export const COPY_PROPS = new Set([
  'alt',
  'aria-description',
  'aria-label',
  'aria-valuetext',
  'cancelLabel',
  'confirmLabel',
  'description',
  'emptyMessage',
  'error',
  'heading',
  'helperText',
  'label',
  'message',
  'placeholder',
  'subtitle',
  'title',
  'tooltip',
]);

// Calls whose string arguments are shown to the user.
const COPY_CALLS =
  /^(?:toast(?:\.\w+)?|(?:window\.)?(?:alert|confirm|prompt))$/;
const COPY_OBJECT_KEYS = new Set(['title', 'description', 'message']);

// Added line numbers per file from `git diff --unified=0` output.
export function parseAddedLines(diff) {
  const added = new Map();
  let file = null;
  for (const line of diff.split('\n')) {
    const header = line.match(/^\+\+\+ (?:b\/(.+)|\/dev\/null)$/);
    if (header) {
      file = header[1] ?? null;
      if (file && !added.has(file)) added.set(file, new Set());
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk && file) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let n = start; n < start + count; n += 1) added.get(file).add(n);
    }
  }
  return added;
}

function textOf(node, sourceFile) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    return [
      node.head.text,
      ...node.templateSpans.map(span => `{…}${span.literal.text}`),
    ].join('');
  }
  if (ts.isJsxText(node)) return node.getText(sourceFile);
  return null;
}

function isTextLike(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node)
  );
}

// Walks up through ternaries, ||, ?? and parentheses to the expression
// that actually receives the string.
function receiver(node) {
  let current = node.parent;
  while (
    current &&
    (ts.isConditionalExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      (ts.isBinaryExpression(current) &&
        [
          ts.SyntaxKind.BarBarToken,
          ts.SyntaxKind.QuestionQuestionToken,
          ts.SyntaxKind.AmpersandAmpersandToken,
        ].includes(current.operatorToken.kind)))
  ) {
    current = current.parent;
  }
  return current;
}

function copyKind(node) {
  if (ts.isJsxText(node)) return 'jsx-text';
  if (!isTextLike(node)) return null;
  const target = receiver(node);
  if (!target) return null;
  if (ts.isJsxAttribute(target)) {
    return COPY_PROPS.has(target.name.getText()) ? 'prop' : null;
  }
  if (ts.isJsxExpression(target)) {
    const owner = target.parent;
    if (ts.isJsxAttribute(owner)) {
      return COPY_PROPS.has(owner.name.getText()) ? 'prop' : null;
    }
    if (ts.isJsxElement(owner) || ts.isJsxFragment(owner)) return 'jsx-text';
    return null;
  }
  if (ts.isCallExpression(target)) {
    return COPY_CALLS.test(target.expression.getText()) ? 'message' : null;
  }
  if (
    ts.isPropertyAssignment(target) &&
    COPY_OBJECT_KEYS.has(target.name.getText()) &&
    ts.isObjectLiteralExpression(target.parent) &&
    ts.isCallExpression(target.parent.parent) &&
    COPY_CALLS.test(target.parent.parent.expression.getText())
  ) {
    return 'message';
  }
  return null;
}

// Every user-visible string in a source file, with its 1-based line.
export function extractCopy(fileName, sourceText) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const found = [];
  const visit = node => {
    const kind = copyKind(node);
    if (kind) {
      const text = textOf(node, sourceFile)?.replace(/\s+/g, ' ').trim();
      if (text && /\p{L}/u.test(text)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        );
        found.push({ line: line + 1, kind, text });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

export function changedCopy(addedLines, readSource) {
  return Promise.all(
    [...addedLines.entries()]
      .filter(([file]) => SOURCE_FILE.test(file) && !EXCLUDED_FILE.test(file))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(async ([file, lines]) =>
        extractCopy(file, await readSource(file))
          .filter(({ line }) => lines.has(line))
          .map(entry => ({ file, ...entry }))
      )
  ).then(groups => groups.flat());
}

function git(...args) {
  return execFileSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function main() {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf('--base');
  const base = baseIndex === -1 ? 'origin/master' : args[baseIndex + 1];
  const mergeBase = git('merge-base', 'HEAD', base).trim();
  // Diff the working tree against the merge base: committed and
  // uncommitted changes both count.
  const diff = git(
    'diff',
    '--unified=0',
    '--diff-filter=AMR',
    mergeBase,
    '--',
    'src'
  );
  const entries = await changedCopy(parseAddedLines(diff), file =>
    readFile(path.join(repositoryRoot, file), 'utf8')
  );
  if (args.includes('--json')) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }
  if (entries.length === 0) {
    console.log(`No user-visible strings added or changed since ${base}.`);
    return;
  }
  for (const { file, line, kind, text } of entries) {
    console.log(`${file}:${line}\t${kind}\t${text}`);
  }
  console.log(`\n${entries.length} string(s) to review against ${base}.`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await main();
}
