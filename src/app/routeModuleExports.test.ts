import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Repair 11 (FR4-1): a Next.js route module may export only its HTTP
 * handlers and route segment config. Next's generated route type check
 * (`.next/dev/types`, included by `tsconfig.json` after any `next dev`)
 * fails `npm run type-check` on any other value export, so helpers and
 * scripts belong in `src/lib/`.
 */
const ALLOWED = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'dynamic',
  'dynamicParams',
  'revalidate',
  'fetchCache',
  'runtime',
  'preferredRegion',
  'maxDuration',
  'generateStaticParams',
]);

function routeModules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return routeModules(full);
    return /^route\.(ts|tsx|js|mjs)$/u.test(entry.name) ? [full] : [];
  });
}

describe('route modules', () => {
  it('export only handlers and segment config', () => {
    const root = path.join(process.cwd(), 'src', 'app');
    const modules = routeModules(root);
    expect(modules.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of modules) {
      const source = readFileSync(file, 'utf8');
      const relative = path.relative(root, file);
      for (const match of source.matchAll(
        /^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gmu
      )) {
        if (!ALLOWED.has(match[1]!)) offenders.push(`${relative}: ${match[1]}`);
      }
      if (/^export\s*(?:\*|\{)/mu.test(source))
        offenders.push(`${relative}: re-export`);
    }
    expect(offenders).toEqual([]);
  });
});
