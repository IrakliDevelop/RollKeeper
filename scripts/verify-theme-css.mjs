import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import postcss from 'postcss';

// Verify the emitted asset contract, independently of globals.css and compiler
// caches. These representative tokens distinguish every supported palette.
const PALETTES = {
  ':root': {
    '--surface': '#e9ebe4',
    '--heading': '#1c2420',
    '--brass-fill': '#a07b2c',
  },
  '[data-theme=dark]': {
    '--surface': '#111915',
    '--heading': '#e9e4d4',
    '--brass-fill': '#c8a14b',
  },
  '[data-theme=blue]': {
    '--surface': '#0f172a',
    '--heading': '#f1f5f9',
    '--brass-fill': '#60a5fa',
  },
};

function normalizeSelector(selector) {
  return selector
    .trim()
    .replace(/\[data-theme\s*=\s*['"]?(\w+)['"]?\s*\]/g, '[data-theme=$1]');
}

export async function verifyThemeCss(buildDirectory = '.next') {
  // Follow the actual app appearance HTML. An orphaned correct stylesheet in
  // static/ must not let a page referencing stale CSS pass this check.
  const html = await readFile(
    path.join(buildDirectory, 'server/app/player/appearance.html'),
    'utf8'
  );
  const stylesheets = new Set();
  for (const [link] of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\brel=["']stylesheet["']/i.test(link)) continue;
    const href = link.match(/\bhref=["']([^"']+)["']/i)?.[1];
    assert.ok(href, 'App appearance stylesheet is missing its href');
    const pathname = new URL(
      href.replaceAll('&amp;', '&'),
      'https://build.invalid'
    ).pathname;
    assert.ok(
      pathname.startsWith('/_next/static/'),
      `Unexpected stylesheet path: ${pathname}`
    );
    const filename = path.resolve(
      buildDirectory,
      pathname.slice('/_next/'.length)
    );
    assert.ok(
      filename.startsWith(path.resolve(buildDirectory, 'static') + path.sep),
      'Stylesheet must be inside the build static directory'
    );
    stylesheets.add(filename);
  }
  assert.ok(
    stylesheets.size > 0,
    'App appearance HTML references no stylesheets'
  );

  const declarations = new Map(
    Object.keys(PALETTES).map(selector => [selector, {}])
  );
  for (const filename of stylesheets) {
    const css = postcss.parse(await readFile(filename, 'utf8'));
    css.walkRules(rule => {
      for (const selector of rule.selectors.map(normalizeSelector)) {
        const palette = declarations.get(selector);
        if (!palette) continue;
        for (const node of rule.nodes) {
          if (node.type === 'decl')
            palette[node.prop] = node.value.toLowerCase();
        }
      }
    });
  }
  for (const [selector, expected] of Object.entries(PALETTES)) {
    for (const [token, value] of Object.entries(expected)) {
      assert.equal(
        declarations.get(selector)[token],
        value,
        `Built app stylesheet has missing or stale ${selector} ${token}`
      );
    }
  }
  return stylesheets.size;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    const count = await verifyThemeCss(process.argv[2]);
    console.log(
      `Production theme CSS verified in ${count} referenced stylesheet(s).`
    );
  } catch (error) {
    console.error(`Production theme CSS verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
