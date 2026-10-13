import fs from 'node:fs';
import path from 'node:path';

import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { validateCampaignMembershipMutation } from '@/lib/campaignMembershipSecurity';
import { battleMapDeleteRequest } from '@/components/ui/campaign/table/sideChannelRequests';
import {
  displayAckRequest,
  displayCapabilityRequest,
  displayDescriptorRequest,
} from '@/components/ui/campaign/table/display/displayRequests';

import { restoreAuthorityFork } from './checkpoint';
import type { TableCanvasCheckpointV1 } from './schema';

/**
 * PR08 desktop A1: every client call to a Table route that authorizes with
 * `mutation=true` (`authorizeTableDm(..., true)` or
 * `validateCampaignMembershipMutation`) must pass the real server-side
 * origin/CSRF/content-type validator, as the browser would send it.
 */
const ORIGIN = 'http://rk-pr-dm.localhost:43209';

function browserRequest(url: string, init: RequestInit = {}): NextRequest {
  const headers = new Headers(init.headers);
  // The browser adds Origin and Host on a same-origin POST.
  headers.set('origin', ORIGIN);
  headers.set('host', new URL(ORIGIN).host);
  return new NextRequest(`${ORIGIN}${url}`, {
    method: init.method ?? 'GET',
    headers,
    body: typeof init.body === 'string' ? init.body : undefined,
  });
}

const checkpoint: TableCanvasCheckpointV1 = {
  protocolVersion: 1,
  generation: 'generation-1',
  revision: 0,
  capturedAt: '2026-10-13T00:00:00.000Z',
  state: {
    cursor: { generation: 'generation-1', revision: 0, streamId: 's' },
    elements: [],
    layers: [],
    extensions: { fog: { pluginName: 'fog', version: 1, data: null } },
  } as never,
};

describe('Table mutation requests pass the server CSRF validator (A1)', () => {
  it('restoreAuthorityFork sends both restore calls through the validator and restores', async () => {
    const rejected: string[] = [];
    const urls: string[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      urls.push(url);
      const verdict = validateCampaignMembershipMutation(
        browserRequest(url, init)
      );
      if (!verdict.ok) {
        rejected.push(url);
        return Response.json({ error: verdict.error }, { status: 403 });
      }
      if (url.endsWith('/checkpoint'))
        return Response.json({
          generation: 'generation-1',
          revision: '0',
          casToken: 'cas-1',
          state: {},
        });
      return Response.json({ status: 'provisioned', generation: 'g2' });
    }) as unknown as typeof fetch;

    const result = await restoreAuthorityFork({
      campaignCode: 'CAMP',
      dmId: 'dm-1',
      sceneId: 'scene-1',
      checkpoint,
      fetcher,
    });

    expect(rejected).toEqual([]);
    expect(urls).toEqual([
      '/api/campaign/CAMP/table/authority/checkpoint',
      '/api/campaign/CAMP/table/authority/initialize-if-empty',
    ]);
    expect(result).toEqual({ status: 'restored' });
  });

  it.each([
    ['display capability', displayCapabilityRequest('CAMP', 'dm-1')],
    [
      'display descriptor',
      displayDescriptorRequest('CAMP', { capability: 'c', nonce: 'n' }),
    ],
    [
      'display ack',
      displayAckRequest(
        'CAMP',
        { capability: 'c', nonce: 'n' },
        {
          displayGeneration: 1,
          epoch: 'e',
          presentationRevision: 1,
          sceneId: null,
          blanked: false,
          phase: 'blank',
        }
      ),
    ],
    ['battle map delete', battleMapDeleteRequest('CAMP', 'map-1', 'dm-1')],
  ])('%s request builder passes the validator', (_label, request) => {
    expect(
      validateCampaignMembershipMutation(
        browserRequest(request.url, request.init)
      )
    ).toEqual({ ok: true });
  });
});

/**
 * Static guard: every Table client module that sends a mutating request
 * uses the one shared `TABLE_MUTATION_HEADERS`; nobody hand-writes the CSRF
 * header (a hand-written header set is how A1 shipped without it).
 */
describe('Table client mutation headers come from one helper (A1 guard)', () => {
  const root = path.resolve(__dirname, '../..');
  const scopes = [
    'lib/table',
    'components/ui/campaign/table',
    'hooks/useTableControl.ts',
    'lib/openTableDisplay.ts',
  ];
  const files = scopes.flatMap(scope => {
    const target = path.join(root, scope);
    if (fs.statSync(target).isFile()) return [target];
    return (fs.readdirSync(target, { recursive: true }) as string[])
      .map(entry => path.join(target, entry))
      .filter(
        file =>
          /\.(ts|tsx)$/u.test(file) &&
          !/\.(test|stories)\.(ts|tsx)$/u.test(file) &&
          !/fixture/u.test(file) &&
          !file.includes(`${path.sep}__tests__${path.sep}`)
      );
  });

  it('finds the known mutation callers', () => {
    const mutating = files
      .filter(file =>
        /method:\s*'(POST|PUT|PATCH|DELETE)'/u.test(
          fs.readFileSync(file, 'utf8')
        )
      )
      .map(file => path.relative(root, file))
      .sort();
    expect(mutating).toEqual(
      [
        'components/ui/campaign/table/display/displayRequests.ts',
        'components/ui/campaign/table/sideChannelRequests.ts',
        'hooks/useTableControl.ts',
        'lib/table/authorityLifecycle.ts',
        'lib/table/checkpoint.ts',
      ].map(file => file.replaceAll('/', path.sep))
    );
  });

  /**
   * The `{ ... }` object literal that encloses `index` (the request init
   * holding `method:`), found by brace balance. Strings and comments in
   * these files never contain unbalanced braces near a request init.
   */
  function enclosingObject(source: string, index: number): string {
    let depth = 0;
    let open = index;
    for (; open >= 0; open -= 1) {
      const char = source[open];
      if (char === '}') depth += 1;
      else if (char === '{') {
        if (depth === 0) break;
        depth -= 1;
      }
    }
    depth = 0;
    let close = open;
    for (; close < source.length; close += 1) {
      const char = source[close];
      if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    return source.slice(open, close + 1);
  }

  const callSites = files.flatMap(file => {
    const source = fs.readFileSync(file, 'utf8');
    return [...source.matchAll(/method:\s*'(POST|PUT|PATCH|DELETE)'/gu)].map(
      match => {
        const line = source.slice(0, match.index).split('\n').length;
        return [
          `${path.relative(root, file)}:${line}`,
          enclosingObject(source, match.index!),
        ] as const;
      }
    );
  });

  it('finds every mutation call site', () => {
    const perFile: Record<string, number> = {};
    for (const [site] of callSites) {
      const file = site
        .slice(0, site.lastIndexOf(':'))
        .replaceAll(path.sep, '/');
      perFile[file] = (perFile[file] ?? 0) + 1;
    }
    expect(perFile).toEqual({
      // session command, acquire, scene-room initialize-if-empty
      'lib/table/authorityLifecycle.ts': 3,
      // restore capture + provision
      'lib/table/checkpoint.ts': 2,
      // marker publish, loot claim, battle-map delete
      'components/ui/campaign/table/sideChannelRequests.ts': 3,
      // shared `post` builder (capability, descriptor, ack)
      'components/ui/campaign/table/display/displayRequests.ts': 1,
      'hooks/useTableControl.ts': 1,
    });
  });

  it.each(callSites)(
    '%s sends TABLE_MUTATION_HEADERS in that request init (review S5)',
    (_site, init) => {
      expect(init).toMatch(/headers:\s*(\{\s*\.\.\.)?TABLE_MUTATION_HEADERS/u);
    }
  );

  it.each(files.map(file => [path.relative(root, file), file]))(
    '%s never hand-writes the CSRF header',
    (_label, file) => {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(
        /['"]x-rollkeeper-csrf['"]\s*:/u
      );
    }
  );
});
