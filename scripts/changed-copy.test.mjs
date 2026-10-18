import assert from 'node:assert/strict';
import test from 'node:test';

import { changedCopy, extractCopy, parseAddedLines } from './changed-copy.mjs';

const component = `import { toast } from 'sonner';

export function Hero({ count, saving }) {
  return (
    <section className="hero bg-surface" data-testid="hero">
      <h1>Keep the game moving, not the paperwork</h1>
      <p>{count} characters ready</p>
      <Button aria-label="Close dialog" variant="ghost" />
      <Input placeholder={\`Search \${count} spells\`} />
      <span>{saving ? 'Saving…' : 'Saved'}</span>
      <Icon name="sword" />
    </section>
  );
}

export function save() {
  toast.success('Character saved successfully!');
  toast({ title: 'Long rest taken', variant: 'success' });
  const key = 'campaign:abc';
  throw new Error('Unexpected state');
}
`;

test('extracts JSX text, copy props, toasts and branch strings', () => {
  assert.deepEqual(
    extractCopy('src/Hero.tsx', component).map(({ line, kind, text }) => [
      line,
      kind,
      text,
    ]),
    [
      [6, 'jsx-text', 'Keep the game moving, not the paperwork'],
      [7, 'jsx-text', 'characters ready'],
      [8, 'prop', 'Close dialog'],
      [9, 'prop', 'Search {…} spells'],
      [10, 'jsx-text', 'Saving…'],
      [10, 'jsx-text', 'Saved'],
      [17, 'message', 'Character saved successfully!'],
      [18, 'message', 'Long rest taken'],
    ]
  );
});

test('ignores class names, test ids, icon names, keys and thrown errors', () => {
  const texts = extractCopy('src/Hero.tsx', component).map(({ text }) => text);
  for (const ignored of [
    'hero bg-surface',
    'hero',
    'ghost',
    'sword',
    'success',
    'campaign:abc',
    'Unexpected state',
  ]) {
    assert.ok(!texts.includes(ignored), `${ignored} should be ignored`);
  }
});

test('parses added line numbers from a zero-context diff', () => {
  const diff = [
    'diff --git a/src/Hero.tsx b/src/Hero.tsx',
    '--- a/src/Hero.tsx',
    '+++ b/src/Hero.tsx',
    '@@ -6 +6 @@ export function Hero',
    '-      <h1>Old</h1>',
    '+      <h1>New</h1>',
    '@@ -20,0 +21,2 @@',
    '+a',
    '+b',
    '@@ -30,3 +33,0 @@',
    'diff --git a/src/gone.ts b/src/gone.ts',
    '+++ /dev/null',
  ].join('\n');
  const added = parseAddedLines(diff);
  assert.deepEqual([...added.get('src/Hero.tsx')], [6, 21, 22]);
  assert.equal(added.has('src/gone.ts'), false);
});

test('reports only strings on added lines, skipping tests and stories', async () => {
  const added = new Map([
    ['src/Hero.tsx', new Set([6, 18])],
    ['src/Hero.test.tsx', new Set([6])],
    ['src/Hero.stories.tsx', new Set([6])],
  ]);
  const entries = await changedCopy(added, async () => component);
  assert.deepEqual(
    entries.map(({ file, line, text }) => [file, line, text]),
    [
      ['src/Hero.tsx', 6, 'Keep the game moving, not the paperwork'],
      ['src/Hero.tsx', 18, 'Long rest taken'],
    ]
  );
});
