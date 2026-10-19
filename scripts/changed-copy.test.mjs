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
      [20, 'error', 'Unexpected state'],
    ]
  );
});

test('ignores class names, test ids, icon names and keys', () => {
  const texts = extractCopy('src/Hero.tsx', component).map(({ text }) => text);
  for (const ignored of [
    'hero bg-surface',
    'hero',
    'ghost',
    'sword',
    'success',
    'campaign:abc',
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
    !entries.some(e => e.text === '/api/spells' && e.kind === 'const'),
    'a non-copy name is not a const (the path may still show up as other)'
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

const kindOf = (entries, text) => entries.find(e => e.text === text)?.kind;

test('prose strings with no copy-shaped receiver are reported as other', () => {
  const source = `
const tagline = 'Multiple characters in one place';
const errors = ['Something got eaten by a mimic', 'Try again'];
function expired() {
  return 'Session expired, sign in again';
}
`;
  const entries = extractCopy('src/test.tsx', source);
  assert.ok(
    ['const', 'other'].includes(
      kindOf(entries, 'Multiple characters in one place')
    ),
    'tagline should be reported'
  );
  assert.equal(kindOf(entries, 'Something got eaten by a mimic'), 'other');
  assert.equal(kindOf(entries, 'Session expired, sign in again'), 'other');
});

test('the other catch-all skips classes, developer messages, modules, types and CSS', () => {
  const source = `'use client';
import x from 'some module';
export { y } from 'other module';
type T = 'long rest' | 'short rest';
function f(active: boolean) {
  const classes = cn('flex items-center', active && 'bg-surface');
  const merged = clsx('px-2 py-1', { 'text-heading font-bold': active });
  console.warn('cache miss for key');
  const lazy = import('lazy module');
  const map = { 'some key here': 1 };
  return (
    <div className="flex gap-2" data-state="is open" onClick={() => go('/to/the/page')}>
      <style jsx>{\`.a { color: red; }\`}</style>
      <style>{'.b { color: blue; }'}</style>
    </div>
  );
}
`;
  const entries = extractCopy('src/test.tsx', source);
  assert.deepEqual(
    entries.map(({ kind, text }) => [kind, text]),
    []
  );
});

test('class-like strings outside class helpers are skipped', () => {
  const source = `
const base = 'rounded-md border border-divider px-3';
const grid = \`grid-cols-\${n} gap-2\`;
const tw = 'hover:bg-surface-raised w-[44px] md:flex';
`;
  assert.deepEqual(extractCopy('src/test.tsx', source), []);
});

test('copy-named object keys are recognized', () => {
  const source = `
const a = { text: 'Multiple characters in one place' };
const b = { 'aria-label': 'Close panel' };
const c = { statusLabel: 'Saving' };
const d = { caption: 'Hit points' };
toast({ body: 'Rest finished' });
`;
  const entries = extractCopy('src/test.tsx', source);
  assert.equal(kindOf(entries, 'Multiple characters in one place'), 'object');
  assert.equal(kindOf(entries, 'Close panel'), 'object');
  assert.equal(kindOf(entries, 'Saving'), 'object');
  assert.equal(kindOf(entries, 'Hit points'), 'object');
  assert.equal(kindOf(entries, 'Rest finished'), 'message');
  assert.ok(
    !entries.some(e => e.text === 'aria-label'),
    'a string-literal key is not itself copy'
  );
});

test('copy-named parameter and binding defaults are props', () => {
  const source = `
function F({ title = 'Critical failure', variant = 'ghost' }) {}
function G(placeholder = 'Search spells') {}
`;
  const entries = extractCopy('src/test.tsx', source);
  assert.equal(kindOf(entries, 'Critical failure'), 'prop');
  assert.equal(kindOf(entries, 'Search spells'), 'prop');
  assert.ok(!entries.some(e => e.text === 'ghost'));
});

test('copy-named variables match case-insensitively', () => {
  const source = `
let message = 'Type the six digits';
const emptyTitle = 'Nothing';
var Hint = 'Tap';
const error_message = 'Broken';
const context = 'ctx';
`;
  const entries = extractCopy('src/test.tsx', source);
  assert.equal(kindOf(entries, 'Type the six digits'), 'const');
  assert.equal(kindOf(entries, 'Nothing'), 'const');
  assert.equal(kindOf(entries, 'Tap'), 'const');
  assert.equal(kindOf(entries, 'Broken'), 'const');
  assert.ok(!entries.some(e => e.text === 'ctx'));
});

test('title, label, text, description and hint setters are copy calls', () => {
  const source = `
setTitle('New campaign');
setDialogLabel('Rename');
setHelpText('Pick one');
setDescription('Short');
setHint('Tap');
setCount('3');
`;
  const entries = extractCopy('src/test.tsx', source);
  for (const text of ['New campaign', 'Rename', 'Pick one', 'Short', 'Tap']) {
    assert.equal(kindOf(entries, text), 'message', text);
  }
  assert.ok(!entries.some(e => e.text === '3'));
});

test('lowercase prose with a hyphen or colon is not mistaken for a class list', () => {
  const source = `
const a = 'level-up complete';
const b = 'note: saved locally';
const c = 'pick a spell/cantrip';
const d = '7-day weeks, 12 months of 30 days';
`;
  const texts = extractCopy('src/test.tsx', source).map(e => e.text);
  for (const text of [
    'level-up complete',
    'note: saved locally',
    'pick a spell/cantrip',
    '7-day weeks, 12 months of 30 days',
  ]) {
    assert.ok(texts.includes(text), `${text} should be reported`);
  }
});

test('Tailwind class lists, ids, paths and CSS stay skipped', () => {
  const source = `
const a = 'flex items-center gap-2';
const b = 'bg-surface text-heading';
const c = '-mt-2 !w-full md:w-1/2';
const d = 'data-[state=open]:bg-surface';
const e = 'long-rest';
const f = 'begin_calendar_staging';
const g = 'application/json,.json';
const h = '/api/campaign/' + code;
const i = \`/api/campaign/\${code}/maps\`;
const j = 'radial-gradient(circle, red 0%, transparent 70%)';
const k = '@/lib/redis';
`;
  assert.deepEqual(extractCopy('src/test.tsx', source), []);
});

test('strings in event handler expressions are listed', () => {
  const source = `
const a = (
  <div>
    <button onClick={() => toast('Character saved')}>Go</button>
    <button onClick={() => addRow('New Day')}>Add</button>
    <button onChange={e => notify(e.ok ? 'Concentration Save' : 'Spell Attack')}>Roll</button>
    <button onClick={() => go('/player/characters')}>Open</button>
  </div>
);
`;
  const entries = extractCopy('src/test.tsx', source);
  assert.equal(kindOf(entries, 'Character saved'), 'message');
  assert.equal(kindOf(entries, 'New Day'), 'other');
  assert.equal(kindOf(entries, 'Concentration Save'), 'other');
  assert.equal(kindOf(entries, 'Spell Attack'), 'other');
  assert.ok(!entries.some(e => e.text.startsWith('/player')));
});

test('single words are listed in label contexts only', () => {
  const source = `
<Button label="Save" />;
<Button>Delete</Button>;
const item = { label: 'Cancel', value: 'cancel' };
const direction = 'Enter';
const keys = ['Escape', 'Backspace'];
`;
  const entries = extractCopy('src/test.tsx', source);
  assert.equal(kindOf(entries, 'Save'), 'prop');
  assert.equal(kindOf(entries, 'Delete'), 'jsx-text');
  assert.equal(kindOf(entries, 'Cancel'), 'object');
  for (const text of ['cancel', 'Enter', 'Escape', 'Backspace']) {
    assert.ok(!entries.some(e => e.text === text), `${text} is not copy`);
  }
});

test('new Error messages in UI files are listed as error', () => {
  const source = `
throw new Error('Sign in to the owner account first.');
throw new TypeError(\`Failed to load \${name}\`);
throw new Error('Unexpected');
throw new Error(ok ? 'Upload failed' : 'Download failed');
`;
  assert.deepEqual(
    extractCopy('src/components/Sync.tsx', source).map(e => [e.kind, e.text]),
    [
      ['error', 'Sign in to the owner account first.'],
      ['error', 'Failed to load {…}'],
      ['error', 'Upload failed'],
      ['error', 'Download failed'],
    ]
  );
});

test('identifier-like new Error messages are not listed as copy', () => {
  const entries = extractCopy(
    'src/components/Sync.tsx',
    `
throw new Error('recovery-unavailable');
throw new Error('Could not save the character');
`
  );
  assert.deepEqual(
    entries.map(e => [e.kind, e.text]),
    [['error', 'Could not save the character']]
  );
});

test('times and ratios are not Tailwind variant evidence', () => {
  const source = `
const a = 'starts at 10:30 sharp';
const b = 'aspect 3:2 portrait';
const c = 'md:flex 2xl:grid hover:bg-surface';
`;
  const texts = extractCopy('src/test.tsx', source).map(e => e.text);
  assert.deepEqual(texts, ['starts at 10:30 sharp', 'aspect 3:2 portrait']);
});

test('new Error messages in lib, api and test code stay developer messages', () => {
  const source = `throw new Error('Sign in to the owner account first.');`;
  for (const file of [
    'src/lib/sync.ts',
    'src/app/api/x/route.ts',
    'src/test/setup.ts',
  ]) {
    assert.deepEqual(extractCopy(file, source), [], file);
  }
});
