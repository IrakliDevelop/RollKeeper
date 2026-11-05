import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const redirect = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { href });
  })
);
vi.mock('next/navigation', () => ({ redirect }));

import LegacyTableScenePage from './page';

async function target(
  sceneId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<string> {
  redirect.mockClear();
  await expect(
    LegacyTableScenePage({
      params: Promise.resolve({ code: 'CAMP', sceneId }),
      searchParams: Promise.resolve(searchParams),
    })
  ).rejects.toThrow('NEXT_REDIRECT');
  expect(redirect).toHaveBeenCalledTimes(1);
  return redirect.mock.calls[0]![0];
}

describe('W8 route matrix: /table/<sceneId> → canonical workspace', () => {
  it('redirects to ?scene= and never presents (no client code runs)', async () => {
    await expect(target('scene-1', {})).resolves.toBe(
      '/dm/campaign/CAMP/table?scene=scene-1'
    );
  });

  it('preserves run and the imported workspace selection raw', async () => {
    await expect(
      target('scene-1', { run: 'run-2', tableWorkspace: 'imported-1' })
    ).resolves.toBe(
      '/dm/campaign/CAMP/table?scene=scene-1&run=run-2&tableWorkspace=imported-1'
    );
  });

  it('never drops an oversized workspace selection to the default workspace', async () => {
    await expect(
      target('scene-1', { tableWorkspace: 'x'.repeat(600) })
    ).resolves.toBe(
      '/dm/campaign/CAMP/table?scene=scene-1&tableWorkspace=invalid'
    );
  });

  it('encodes unusual scene ids instead of trusting them', async () => {
    await expect(target('a b/c', {})).resolves.toBe(
      '/dm/campaign/CAMP/table?scene=a+b%2Fc'
    );
  });
});

describe('W8 route matrix: display routes stay outside the DM workspace', () => {
  const root = path.resolve(__dirname, '../../../../../..');
  it.each([
    'app/dm/campaign/[code]/battlemaps/[id]/display/page.tsx',
    'app/table-display/[code]/page.tsx',
  ])('%s never redirects into /table', file => {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    expect(source).not.toMatch(/\/table\?|redirect\(/u);
  });
});
