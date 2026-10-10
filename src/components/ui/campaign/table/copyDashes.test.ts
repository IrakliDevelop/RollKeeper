import fs from 'node:fs';
import path from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * O7-3 W6 / W8R-1 / W9N-2: Table and TV copy uses no em or en dashes. Reads
 * the non-test W1-scope sources and checks every string literal, template
 * literal part and JSX text node. Comments are never inspected: the
 * TypeScript parser separates them from literals, so a dash inside a string
 * that looks like a comment is still caught and a dash in a comment is not.
 */
const DASHES = /[–—]/u;

/** Entries are `relative/path:line` and each needs a logged reason. */
const ALLOW_LIST: readonly string[] = [];

const SRC = path.resolve(__dirname, '..', '..', '..', '..');
const TABLE_DIR = path.join(SRC, 'components', 'ui', 'campaign', 'table');

function listSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    if (!/\.tsx?$/u.test(entry.name)) return [];
    if (/\.(test|stories|fixture)\.tsx?$/u.test(entry.name)) return [];
    return [full];
  });
}

const FILES = [
  ...listSources(TABLE_DIR),
  path.join(SRC, 'lib', 'openTableDisplay.ts'),
  path.join(SRC, 'lib', 'table', 'authorityLifecycle.ts'),
  path.join(SRC, 'lib', 'table', 'repository.ts'),
  path.join(SRC, 'lib', 'table', 'sceneImage.ts'),
  path.join(SRC, 'app', 'table-display', '[code]', 'page.tsx'),
];

const LITERAL_KINDS = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
  ts.SyntaxKind.TemplateHead,
  ts.SyntaxKind.TemplateMiddle,
  ts.SyntaxKind.TemplateTail,
  ts.SyntaxKind.JsxText,
]);

export function findDashedLiterals(fileName: string, source: string) {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const hits: Array<{ line: number; text: string }> = [];
  const visit = (node: ts.Node) => {
    if (LITERAL_KINDS.has(node.kind)) {
      const text = node.getText(file);
      if (DASHES.test(text)) {
        const { line } = file.getLineAndCharacterOfPosition(
          node.getStart(file)
        );
        hits.push({ line: line + 1, text: text.trim() });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return hits;
}

describe('O7-3 no em or en dashes in Table copy', () => {
  it('scans the whole W1 scope', () => {
    expect(FILES.length).toBeGreaterThan(70);
    for (const file of FILES) expect(fs.existsSync(file)).toBe(true);
  });

  it('flags literals and JSX text but ignores comments', () => {
    const dash = '—';
    const source = [
      `// a comment ${dash} ignored`,
      `/* block ${dash} ignored */`,
      `const a = 'x ${dash} y';`,
      `const b = \`t ${dash} \${a}\`;`,
      `const c = '// not a comment ${dash}';`,
      `const d = <p>jsx ${dash} text</p>;`,
      `const e = 'plain';`,
    ].join('\n');
    expect(
      findDashedLiterals('sample.tsx', source).map(hit => hit.line)
    ).toEqual([3, 4, 5, 6]);
  });

  it.each(FILES.map(file => [path.relative(SRC, file), file]))(
    '%s has no dashes in user-visible strings',
    (name, file) => {
      const hits = findDashedLiterals(file, fs.readFileSync(file, 'utf8'))
        .filter(hit => !ALLOW_LIST.includes(`${name}:${hit.line}`))
        .map(hit => `${name}:${hit.line} ${hit.text}`);
      expect(hits).toEqual([]);
    }
  );
});
