import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readThemeColours } from '../themeTokens';

// Read from disk: the unit project doesn't process CSS, so `?raw` is empty.
const globalsCss = readFileSync(
  path.join(process.cwd(), 'src/app/globals.css'),
  'utf8'
);

describe('readThemeColours', () => {
  const colours = readThemeColours(globalsCss);

  it('lists the six roles in order, each with its job and four tokens', () => {
    expect(colours.roles.map(r => r.role)).toEqual([
      'brass',
      'blood',
      'verdigris',
      'lapis',
      'ember',
      'frost',
    ]);
    for (const { role, job, tokens } of colours.roles) {
      expect(job, role).toBeTruthy();
      expect(tokens.slice(0, 4)).toEqual([
        `--${role}-text`,
        `--${role}-fill`,
        `--${role}-border`,
        `--${role}-bg`,
      ]);
    }
    expect(colours.roles[0].tokens).toContain('--on-brass');
    expect(colours.roles[1].tokens).toContain('--on-blood');
  });

  // The Foundations page shows each note, so a new neutral needs one.
  it('gives every neutral a note naming its job', () => {
    expect(colours.neutrals.map(n => n.name)).toEqual(
      expect.arrayContaining(['--surface', '--surface-elevated', '--heading'])
    );
    for (const { name, note } of colours.neutrals) {
      expect(note, name).toBeTruthy();
    }
  });

  // A token only paper defines would show paper's value in the felt panel.
  it.each(['dark', 'blue'])(
    'finds every neutral and role token in the %s block too',
    theme => {
      const felt = globalsCss.match(
        new RegExp(`\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`)
      );
      expect(felt).not.toBeNull();
      const names = new Set(
        Array.from(felt![1].matchAll(/(--[\w-]+)\s*:/g), m => m[1])
      );
      const tokens = [
        ...colours.neutrals.map(n => n.name),
        ...colours.roles.flatMap(r => r.tokens),
      ];
      expect(tokens.filter(name => !names.has(name))).toEqual([]);
    }
  );

  it('leaves out the overlay shadow and the deprecated bridge', () => {
    const names = colours.neutrals.map(n => n.name);
    expect(names).not.toContain('--overlay-shadow');
    expect(names.some(n => n.startsWith('--bridge-'))).toBe(false);
    const roleTokens = colours.roles.flatMap(r => r.tokens);
    expect(roleTokens.some(n => n.startsWith('--bridge-'))).toBe(false);
  });

  it('lists the tokens defined in terms of others', () => {
    expect(colours.aliases).toEqual(
      expect.arrayContaining([
        { name: '--background', target: '--surface' },
        { name: '--ring', target: '--brass-fill' },
      ])
    );
  });

  it('reads a missing note, any colour notation and a multi-line value', () => {
    const css = `/* paper */
:root,
[data-theme='light'] {
  /* --- Neutrals --- */
  --surface: #fff; /* page canvas */
  --divider: oklch(80% 0.01 120);
  --overlay-shadow:
    0 8px 24px rgb(0 0 0 / 0.1);
  /* --- Roles --- */
  --brass-text: #a07b2c; /* primary action */
  --brass-fill: #a07b2c;
  --on-brass: #000;
  /* --- Deprecated --- */
  --bridge-x: #000;
}
:root,
[data-theme] {
  --ring: var(--brass-fill);
}`;
    expect(readThemeColours(css)).toEqual({
      neutrals: [
        { name: '--surface', note: 'page canvas' },
        { name: '--divider', note: null },
      ],
      roles: [
        {
          role: 'brass',
          job: 'primary action',
          tokens: ['--brass-text', '--brass-fill', '--on-brass'],
        },
      ],
      aliases: [{ name: '--ring', target: '--brass-fill' }],
    });
  });

  it('fails loudly when a section heading is missing', () => {
    const css = `:root,
[data-theme='light'] {
  /* --- Neutrals --- */
  --surface: #fff; /* page canvas */
  /* --- Deprecated --- */
}`;
    expect(() => readThemeColours(css)).toThrow(/lost a section heading/);
  });

  it('fails loudly when the paper block is missing', () => {
    expect(() => readThemeColours('body { color: red; }')).toThrow(/No paper/);
  });
});
