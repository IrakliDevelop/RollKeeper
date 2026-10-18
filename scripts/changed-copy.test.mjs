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

test('addToast and setError calls are recognized as copy', () => {
  const source = `
import { addToast } from '@/lib/toast';
function onSave() {
  addToast({ title: 'Long rest taken', message: 'Hit points restored' });
  setError('Complete the check');
}
`;
  const entries = extractCopy('src/test.tsx', source);
  const toastTitle = entries.find(e => e.text === 'Long rest taken');
  const toastMessage = entries.find(e => e.text === 'Hit points restored');
  const errorMsg = entries.find(e => e.text === 'Complete the check');
  assert.ok(toastTitle, 'addToast title should be extracted');
  assert.equal(
    toastTitle?.kind,
    'message',
    'addToast title should be kind message'
  );
  assert.ok(toastMessage, 'addToast message should be extracted');
  assert.equal(
    toastMessage?.kind,
    'message',
    'addToast message should be kind message'
  );
  assert.ok(errorMsg, 'setError should be extracted');
  assert.equal(errorMsg?.kind, 'message', 'setError should be kind message');
});

test('copy-keyed object literals are recognized anywhere', () => {
  const source = `
const config = { id: 'actions', label: 'Actions', variant: 'default' };
const item = { key: 'key', title: 'New Item', type: 'button' };
const ignored = { icon: 'check', className: 'mb-4' };
tabs.push({ id: 'a', label: 'Pushed label' });
registerTab({ title: 'Registered title' });
`;
  const entries = extractCopy('src/test.tsx', source);
  const actionLabel = entries.find(e => e.text === 'Actions');
  const newItem = entries.find(e => e.text === 'New Item');
  const pushedLabel = entries.find(e => e.text === 'Pushed label');
  const registeredTitle = entries.find(e => e.text === 'Registered title');

  assert.ok(actionLabel, 'label in config should be extracted');
  assert.equal(
    actionLabel?.kind,
    'object',
    'config label should be kind object'
  );
  assert.ok(newItem, 'title in config should be extracted');
  assert.equal(newItem?.kind, 'object', 'config title should be kind object');
  assert.ok(pushedLabel, 'label in non-copy-call argument should be extracted');
  assert.equal(
    pushedLabel?.kind,
    'object',
    'tabs.push label should be kind object'
  );
  assert.ok(
    registeredTitle,
    'title in non-copy-call argument should be extracted'
  );
  assert.equal(
    registeredTitle?.kind,
    'object',
    'registerTab title should be kind object'
  );

  const texts = entries.map(e => e.text);
  assert.ok(!texts.includes('button'), 'type should be ignored');
  assert.ok(!texts.includes('check'), 'icon should be ignored');
  assert.ok(!texts.includes('mb-4'), 'className should be ignored');
});

test('prop names with Label, Text, Title suffixes are recognized', () => {
  const source = `
<Button confirmText="Delete character" resetLabel="Reset" variant="danger" />;
<Input ariaLabel="Search spells" className="w-full" />;
`;
  const entries = extractCopy('src/test.tsx', source);
  const texts = entries.map(e => e.text);
  assert.ok(
    texts.includes('Delete character'),
    'confirmText should be extracted'
  );
  assert.ok(texts.includes('Reset'), 'resetLabel should be extracted');
  assert.ok(texts.includes('Search spells'), 'ariaLabel should be extracted');
  assert.ok(!texts.includes('danger'), 'variant should be ignored');
  assert.ok(!texts.includes('w-full'), 'className should be ignored');
});

test('string constants in SCREAMING_SNAKE_CASE are recognized', () => {
  const source = `
const EMPTY_STATE = 'No spells yet';
const DIALOG_TITLE = 'Confirm action';
const apiPath = '/api/spells';
const emptyMessage = 'No results';
const saveLabel = 'Save character';
`;
  const entries = extractCopy('src/test.tsx', source);
  const texts = entries.map(e => e.text);
  assert.ok(
    texts.includes('No spells yet'),
    'SCREAMING_SNAKE_CASE constant should be extracted'
  );
  assert.ok(
    texts.includes('Confirm action'),
    'SCREAMING_SNAKE_CASE constant should be extracted'
  );
  assert.ok(
    !texts.includes('/api/spells'),
    'non-screaming constant should be ignored'
  );
  assert.ok(
    texts.includes('No results'),
    'emptyMessage suffix constant should be extracted'
  );
  assert.ok(
    texts.includes('Save character'),
    'Label suffix constant should be extracted'
  );
});

test('type wrappers (as, satisfies, !) are unwrapped', () => {
  const source = `
<Button title={'Close' as string} />;
<Input placeholder={'Search' satisfies string} />;
`;
  const entries = extractCopy('src/test.tsx', source);
  const texts = entries.map(e => e.text);
  assert.ok(texts.includes('Close'), 'as string wrapper should be unwrapped');
  assert.ok(
    texts.includes('Search'),
    'satisfies string wrapper should be unwrapped'
  );
});

test('multi-line strings report when any line is added', async () => {
  const source = `<div>
    <p>
      This is a paragraph spanning
      multiple lines in the JSX
    </p>
  </div>`;
  // JSX text spans lines 3-4, only line 4 (middle) is added
  const added = new Map([['src/test.tsx', new Set([4])]]);
  const entries = await changedCopy(added, async () => source);
  assert.ok(
    entries.length > 0,
    'should report string when middle line is added'
  );
  const paragraphEntry = entries[0];
  assert.ok(
    paragraphEntry.text.includes('paragraph spanning'),
    'should include text from multi-line entry'
  );
});

test('parses diff headers with spaces and strips trailing tabs', () => {
  const diff = [
    'diff --git a/src/my file.tsx b/src/my file.tsx',
    '--- a/src/my file.tsx',
    '+++ b/src/my file.tsx\t',
    '@@ -5 +5 @@',
    '+new line',
  ].join('\n');
  const added = parseAddedLines(diff);
  assert.ok(added.has('src/my file.tsx'), 'should parse path with spaces');
  assert.deepEqual([...added.get('src/my file.tsx')], [5]);
});
