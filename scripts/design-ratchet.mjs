// Per-file ratchet for legacy visual patterns retired by the Felt and Brass
// design system. Counts may only go down, file by file.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { readSourceFiles, repositoryRoot } from './lib/design-source.mjs';

const HUES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const VARIANTS = '(?<![\\w-])(?:[\\w-]+:)*';

export const PATTERNS = [
  {
    id: 'gradient',
    description: 'gradient backgrounds',
    regex: new RegExp(`${VARIANTS}bg-(?:gradient|linear)-to-[a-z]+`, 'g'),
  },
  {
    id: 'gradient-stop',
    description: 'gradient from-/via- stops',
    regex: new RegExp(
      `${VARIANTS}(?:from|via)-(?:transparent|white|black|current|(?:${HUES})-\\d{2,3}|accent-|surface|\\[|\\()`,
      'g'
    ),
  },
  {
    id: 'hover-motion',
    description: 'hover/press scale or translate',
    regex: new RegExp(
      `${VARIANTS}(?:hover|group-hover|active|focus|group-focus-within):-?(?:scale|translate)-`,
      'g'
    ),
  },
  {
    id: 'large-shadow',
    description: 'shadow-lg/xl/2xl',
    regex: new RegExp(`${VARIANTS}shadow-(?:lg|xl|2xl)(?![\\w-])`, 'g'),
  },
  {
    id: 'backdrop-blur',
    description: 'backdrop blur',
    regex: /(?<![\w-])(?:[\w-]+:)*backdrop-blur/g,
  },
  {
    id: 'accent-hue',
    description: 'hue-named accent tokens (use roles)',
    regex:
      /accent-(?:emerald|blue|amber|red|purple|indigo|green|orange|yellow|violet)-/g,
  },
  {
    id: 'raw-hue',
    description: 'raw Tailwind hue classes',
    regex: new RegExp(
      `${VARIANTS}(?:bg|text|border|ring|from|via|to|fill|stroke|divide|outline|shadow|decoration|placeholder|caret)-(?:${HUES})-\\d{2,3}(?![\\w-])`,
      'g'
    ),
  },
  {
    id: 'uppercase',
    description: 'uppercase labels',
    regex: /(?<![\w-])(?:[\w-]+:)*uppercase(?![\w-])/g,
  },
  {
    id: 'sparkles',
    description: 'Sparkles icon imports',
    regex: /import\s*\{[^}]*\bSparkles\b[^}]*\}\s*from\s*['"]lucide-react['"]/g,
  },
  {
    id: 'overlay-shadow',
    description: 'shadow-overlay outside the floating-layer primitives',
    regex: new RegExp(`${VARIANTS}shadow-overlay(?![\\w-])`, 'g'),
  },
  {
    id: 'number-input',
    description: 'type="number" inputs (use NumberInput)',
    regex: /type=(?:"number"|'number'|\{\s*['"]number['"]\s*\})/g,
  },
];

// Files whose matches are intentional: hpColor.ts's raw fills are
// deliberate, and shadow-overlay belongs to the floating-layer primitives
// (popover, menu, tooltip, dialog, drawer, toast) and nowhere else.
export const ALLOWLIST = {
  'raw-hue': ['src/utils/hpColor.ts'],
  'overlay-shadow': [
    'src/components/ui/primitives/variants.ts',
    'src/components/ui/feedback/SideDrawer.tsx',
  ],
};

export function collectCounts(
  files,
  patterns = PATTERNS,
  allowlist = ALLOWLIST
) {
  const counts = {};
  for (const { path: file, text } of files) {
    for (const pattern of patterns) {
      if (allowlist[pattern.id]?.includes(file)) continue;
      const matches = text.match(pattern.regex)?.length ?? 0;
      if (matches === 0) continue;
      counts[pattern.id] ??= {};
      counts[pattern.id][file] = matches;
    }
  }
  return counts;
}

export function compareToBaseline(current, baseline) {
  const regressions = [];
  const improvements = [];
  const patternIds = new Set([
    ...Object.keys(current),
    ...Object.keys(baseline),
  ]);
  for (const pattern of [...patternIds].sort()) {
    const files = new Set([
      ...Object.keys(current[pattern] ?? {}),
      ...Object.keys(baseline[pattern] ?? {}),
    ]);
    for (const file of [...files].sort()) {
      const was = baseline[pattern]?.[file] ?? 0;
      const now = current[pattern]?.[file] ?? 0;
      if (now > was) regressions.push({ pattern, file, was, now });
      if (now < was) improvements.push({ pattern, file, was, now });
    }
  }
  return { regressions, improvements };
}

export function formatReport({ regressions, improvements }) {
  const lines = [];
  if (regressions.length === 0) {
    lines.push('Design ratchet: OK');
  } else {
    lines.push(
      'Design ratchet: legacy visual patterns increased. Use the Felt and Brass',
      'roles and primitives instead (see docs/wiki/09-design-system-ui.md, "Design ratchet").'
    );
    for (const { pattern, file, was, now } of regressions) {
      lines.push(`  ${pattern}: ${file} ${was} -> ${now}`);
    }
    lines.push(
      'If a file was only moved or renamed, its old counts moved with it:',
      'run `npm run design:baseline -- --force` and say so in the PR.'
    );
  }
  if (improvements.length > 0) {
    lines.push(
      `${improvements.length} count(s) went down. Run \`npm run design:baseline\` to lock them in.`
    );
  }
  return lines.join('\n');
}

const baselinePath = path.join(
  repositoryRoot,
  'scripts',
  'design-ratchet-baseline.json'
);

function sortCounts(counts) {
  return Object.fromEntries(
    Object.keys(counts)
      .sort()
      .map(pattern => [
        pattern,
        Object.fromEntries(
          Object.keys(counts[pattern])
            .sort()
            .map(file => [file, counts[pattern][file]])
        ),
      ])
  );
}

// Returns the parsed baseline, or null when the file does not exist yet.
// Any other problem (unreadable file, malformed JSON) is thrown.
export async function readBaseline(file = baselinePath) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export const MISSING_BASELINE_HINT =
  'Design ratchet: no baseline at scripts/design-ratchet-baseline.json. Run `npm run design:baseline` to create it.';

// Runs the ratchet and reports what happened instead of exiting, so tests
// can drive it with a temporary baseline file.
export async function runRatchet({
  mode = 'check',
  flags = [],
  file = baselinePath,
  readFiles = readSourceFiles,
} = {}) {
  const current = collectCounts(await readFiles());
  const baseline = await readBaseline(file);

  if (baseline === null && mode !== 'update') {
    return { exitCode: 1, stdout: '', stderr: MISSING_BASELINE_HINT };
  }

  const result = compareToBaseline(current, baseline ?? {});

  if (mode === 'update') {
    if (
      baseline !== null &&
      result.regressions.length > 0 &&
      !flags.includes('--force')
    ) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `${formatReport(result)}\nRefusing to raise the baseline without --force.`,
      };
    }
    await writeFile(file, `${JSON.stringify(sortCounts(current), null, 2)}\n`);
    return {
      exitCode: 0,
      stdout:
        baseline === null
          ? 'Design ratchet baseline created.'
          : 'Design ratchet baseline updated.',
      stderr: '',
    };
  }

  return {
    exitCode: result.regressions.length > 0 ? 1 : 0,
    stdout: formatReport(result),
    stderr: '',
  };
}

async function main() {
  const [mode = 'check', ...flags] = process.argv.slice(2);
  const { exitCode, stdout, stderr } = await runRatchet({ mode, flags });
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
  process.exitCode = exitCode;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
