import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * W12: the new Table workspace UI uses semantic theme tokens only (light and
 * dark resolve through CSS custom properties), never raw palette colours.
 */
const FILES = [
  ...fs
    .readdirSync(__dirname)
    .filter(name => name.endsWith('.tsx') && !name.includes('.test.'))
    .map(name => path.join(__dirname, name)),
  path.join(__dirname, '..', 'TablePartyArrival.tsx'),
  path.join(__dirname, '..', 'TableEntryLinks.tsx'),
  path.join(__dirname, '..', 'combat', 'OpenSceneRunLink.tsx'),
];
const RAW =
  /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b|#[0-9a-f]{3,8}\b/iu;

describe('W12 semantic tokens in the workspace UI', () => {
  it.each(FILES.map(file => [path.relative(__dirname, file), file]))(
    '%s has no raw colour classes',
    (_name, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const offending = source
        .split('\n')
        .filter(line => RAW.test(line) && !line.trim().startsWith('//'));
      expect(offending).toEqual([]);
    }
  );
});
