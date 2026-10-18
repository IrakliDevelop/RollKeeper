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
  /^(?:toast(?:\.\w+)?|addToast|(?:window\.)?(?:alert|confirm|prompt)|set\w*(?:Error|Message|Notice|Status))$/;
const COPY_OBJECT_KEYS = new Set([
  'title',
  'description',
  'message',
  'label',
  'placeholder',
  'tooltip',
  'helperText',
  'emptyMessage',
  'confirmLabel',
  'cancelLabel',
  'confirmText',
  'cancelText',
  'heading',
  'subtitle',
  'hint',
  'error',
]);

// Added line numbers per file from `git diff --unified=0` output.
export function parseAddedLines(diff) {
  const added = new Map();
  let file = null;
  for (const line of diff.split('\n')) {
    const header = line.match(/^\+\+\+ (?:b\/(.+)|\/dev\/null)/);
    if (header && header[1]) {
      // Strip trailing tab and anything after it from the path
      file = header[1].split('\t')[0];
      if (!added.has(file)) added.set(file, new Set());
      continue;
    }
    if (line === '+++ /dev/null') {
      file = null;
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

// Walks up through ternaries, ||, ??, parentheses, and type wrappers (as, satisfies, !)
// to the expression that actually receives the string.
function receiver(node) {
  let current = node.parent;
  while (
    current &&
    (ts.isConditionalExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current) ||
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

// Determine if a const variable name indicates copy (SCREAMING_SNAKE_CASE or *Label/Text/Title/Message suffix)
function isConstCopyName(name) {
  return (
    /^[A-Z][A-Z0-9_]*$/.test(name) || /(?:Label|Text|Title|Message)$/.test(name)
  );
}

// Determine if a prop name indicates copy (in COPY_PROPS or matches pattern)
function isCopyPropName(name) {
  return (
    COPY_PROPS.has(name) ||
    /(?:Label|Text|Title|Description|Message|Hint|Placeholder|Heading)$/.test(
      name
    )
  );
}

function copyKind(node) {
  if (ts.isJsxText(node)) return 'jsx-text';
  if (!isTextLike(node)) return null;
  const target = receiver(node);
  if (!target) return null;

  // JSX attribute
  if (ts.isJsxAttribute(target)) {
    return isCopyPropName(target.name.getText()) ? 'prop' : null;
  }

  // JSX expression inside attribute
  if (ts.isJsxExpression(target)) {
    const owner = target.parent;
    if (ts.isJsxAttribute(owner)) {
      return isCopyPropName(owner.name.getText()) ? 'prop' : null;
    }
    if (ts.isJsxElement(owner) || ts.isJsxFragment(owner)) return 'jsx-text';
    return null;
  }

  // Function call (toast, addToast, setError, etc.)
  if (ts.isCallExpression(target)) {
    return COPY_CALLS.test(target.expression.getText()) ? 'message' : null;
  }

  // Property assignment in object literal (check key)
  if (ts.isPropertyAssignment(target)) {
    const keyName = target.name.getText();
    if (!COPY_OBJECT_KEYS.has(keyName)) return null;

    // Could be in a toast/addToast call or standalone config
    let parent = target.parent;
    if (!ts.isObjectLiteralExpression(parent)) return null;
    parent = parent.parent;

    // In a call expression that matches COPY_CALLS - kind is 'message'
    if (
      ts.isCallExpression(parent) &&
      COPY_CALLS.test(parent.expression.getText())
    ) {
      return 'message';
    }

    // Otherwise (standalone config or non-copy call) - kind is 'object'
    return 'object';
  }

  // Variable initializer (const with copy name)
  if (ts.isVariableDeclaration(target)) {
    const varName = target.name.getText();
    return isConstCopyName(varName) ? 'const' : null;
  }

  return null;
}

// Every user-visible string in a source file, with its 1-based line and endLine.
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
        const start = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile)
        );
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        found.push({
          line: start.line + 1,
          endLine: end.line + 1,
          kind,
          text,
        });
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
          .filter(({ line, endLine }) => {
            // Report if any line in [line, endLine] is in the added set
            for (let i = line; i <= endLine; i += 1) {
              if (lines.has(i)) return true;
            }
            return false;
          })
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
  let base = 'origin/master';
  if (baseIndex !== -1) {
    if (baseIndex + 1 >= args.length) {
      console.error('copy:changed: --base requires a value');
      process.exit(1);
    }
    base = args[baseIndex + 1];
  }

  let mergeBase;
  try {
    mergeBase = git('merge-base', 'HEAD', base).trim();
  } catch {
    console.error(
      `copy:changed: unknown base "${base}". Pass --base <branch the PR targets>.`
    );
    process.exit(1);
  }

  // Diff the working tree against the merge base: committed and uncommitted changes both count.
  const diff = git(
    '-c',
    'core.quotepath=off',
    'diff',
    '--no-color',
    '--no-ext-diff',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    '--unified=0',
    '--diff-filter=AMR',
    mergeBase,
    '--',
    'src'
  );

  const added = parseAddedLines(diff);

  // Also list untracked files and treat all lines as added
  const untracked = git(
    'ls-files',
    '--others',
    '--exclude-standard',
    '--',
    'src'
  )
    .split('\n')
    .filter(f => f);
  for (const file of untracked) {
    if (SOURCE_FILE.test(file) && !EXCLUDED_FILE.test(file)) {
      if (!added.has(file)) {
        added.set(file, new Set());
      }
      // For untracked files, we need to know the line count
      try {
        const content = await readFile(path.join(repositoryRoot, file), 'utf8');
        const lineCount = content.split('\n').length;
        for (let i = 1; i <= lineCount; i += 1) {
          added.get(file).add(i);
        }
      } catch {
        // Ignore read errors for untracked files
      }
    }
  }

  const entries = await changedCopy(added, file =>
    readFile(path.join(repositoryRoot, file), 'utf8')
  );

  if (args.includes('--json')) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (baseIndex === -1) {
    console.log(`Comparing against ${base} (pass --base <PR base> to change).`);
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
