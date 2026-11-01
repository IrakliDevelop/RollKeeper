import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyThemeCss } from './verify-theme-css.mjs';

const paper =
  ':root,[data-theme=light]{--surface:#e9ebe4;--heading:#1c2420;--brass-fill:#a07b2c}';
const dark =
  '[data-theme="dark"]{--surface:#111915;--heading:#e9e4d4;--brass-fill:#c8a14b}';
const blue =
  "[data-theme='blue']{--surface:#0f172a;--heading:#f1f5f9;--brass-fill:#60a5fa}";

async function fixture(t, css) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), 'rollkeeper-built-theme-')
  );
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'server/app/player'), { recursive: true });
  await mkdir(path.join(directory, 'static/immutable/chunks'), {
    recursive: true,
  });
  await writeFile(
    path.join(directory, 'server/app/player/appearance.html'),
    '<html><head><link href="/_next/static/immutable/chunks/app.css" rel="stylesheet" /></head></html>'
  );
  await writeFile(path.join(directory, 'static/immutable/chunks/app.css'), css);
  return directory;
}

test('accepts the three palettes in the stylesheet referenced by the built page', async t => {
  const directory = await fixture(t, paper + dark + blue);
  assert.equal(await verifyThemeCss(directory), 1);
});

test('rejects the deployed failure: new page referencing CSS without the blue palette', async t => {
  const directory = await fixture(t, paper + dark);
  await assert.rejects(
    verifyThemeCss(directory),
    /missing or stale \[data-theme=blue\] --surface/
  );
});

test('does not accept a correct orphan stylesheet when the page references stale CSS', async t => {
  const directory = await fixture(t, paper + dark);
  await writeFile(
    path.join(directory, 'static/immutable/chunks/orphan.css'),
    paper + dark + blue
  );
  await assert.rejects(
    verifyThemeCss(directory),
    /missing or stale \[data-theme=blue\] --surface/
  );
});

test('rejects a named blue scope containing the light palette', async t => {
  const directory = await fixture(
    t,
    paper + dark + blue.replace('#0f172a', '#e9ebe4')
  );
  await assert.rejects(
    verifyThemeCss(directory),
    /missing or stale \[data-theme=blue\] --surface/
  );
});

test('fails closed when the built page has no linked stylesheet', async t => {
  const directory = await fixture(t, paper + dark + blue);
  await writeFile(
    path.join(directory, 'server/app/player/appearance.html'),
    '<html></html>'
  );
  await assert.rejects(verifyThemeCss(directory), /references no stylesheets/);
});
