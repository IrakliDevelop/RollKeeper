import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CODE,
  DISPLAY_CAPABILITY,
  DISPLAY_GENERATION,
  DISPLAY_KEY,
  DISPLAY_NONCE,
  DM_ID,
  EPOCH,
  clientRequest,
  createTableFakeRedis,
  issueDisplay,
  params,
  registryEntry,
  seedTavernAndForest,
  setPresentation,
  setRegistryEntry,
  sha256Hex,
} from './tableFakeRedis';
import { installDisplayEval } from './tableDisplayFake';
import {
  tableControlKey,
  tableDisplayAckKey,
  tableDisplaySessionKey,
} from '@/lib/tableServer/keys';

const fake = vi.hoisted(() => ({ current: null as unknown }));
const membership = vi.hoisted(() => ({
  value: { mode: 'legacy' } as Record<string, unknown>,
}));
vi.mock('@/lib/redis', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/redis')>();
  const target = () =>
    fake.current as ReturnType<
      typeof import('./tableFakeRedis').createTableFakeRedis
    >;
  return {
    ...actual,
    getRedis: () => target().redis,
    getRawRedis: () => target().rawRedis,
    refreshCampaignTTL: async () => {},
  };
});
vi.mock('@/lib/supabase/campaignMembershipServer', () => ({
  authorizeCampaignMembershipRoute: vi.fn(async () => membership.value),
}));
vi.mock('@/lib/tableServer/authorityProof', () => ({
  proveRelayAuthority: vi.fn(async () => true),
}));

import { POST as capabilityPOST } from '../table/display/capability/route';
import { POST as descriptorPOST } from '../table/display/descriptor/route';
import { POST as ackPOST } from '../table/display/ack/route';
import { GET as statusGET } from '../table/display/status/route';
import { POST as displayKeyPOST } from '../display-key/route';
import {
  displayAckRequest,
  displayCapabilityRequest,
  displayDescriptorRequest,
  displayStatusUrl,
  legacyDisplayKeyRequest,
  type DisplayAck,
} from '@/components/ui/campaign/table/display/displayRequests';

let store: ReturnType<typeof createTableFakeRedis>;
let now = 1_000_000;
const credential = { capability: DISPLAY_CAPABILITY, nonce: DISPLAY_NONCE };
const EXPIRED = { error: 'Display link expired' };
const IN_USE = { error: 'Display link is in use on another screen' };
const ORIGIN_FAILED = { error: 'Request origin or CSRF validation failed' };

type Handler = (
  request: NextRequest,
  context: ReturnType<typeof params>
) => Promise<Response>;

async function send(
  route: Handler,
  built: { url: string; init: RequestInit },
  headers: Record<string, string | null> = {}
) {
  const base = clientRequest(built.url, built.init);
  const merged = new Headers(base.headers);
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) merged.delete(name);
    else merged.set(name, value);
  }
  const request = new NextRequest(base.url, {
    method: base.method,
    headers: merged,
    body: built.init.body as BodyInit | undefined,
  });
  const response = await route(request, params());
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
  };
}

const control = () =>
  JSON.parse(store.strings.get(tableControlKey(CODE))!) as Record<
    string,
    unknown
  > & { presentation: { revision: number } };

function ack(extra: Partial<DisplayAck> = {}): DisplayAck {
  return {
    displayGeneration: DISPLAY_GENERATION,
    epoch: EPOCH,
    presentationRevision: 3,
    sceneId: 'scene-tavern',
    blanked: false,
    phase: 'loaded',
    ...extra,
  };
}

beforeEach(() => {
  now = 1_000_000;
  store = createTableFakeRedis();
  installDisplayEval(store, () => now);
  fake.current = store;
  membership.value = { mode: 'legacy' };
  seedTavernAndForest(store);
  process.env.TABLE_PROTOCOL_V1_REQUIRED = 'true';
  process.env.BATTLEMAP_RELAY_SECRET = 'synthetic-relay-secret';
  delete process.env.SUPABASE_HYBRID_GUEST_ENABLED;
});
afterEach(() => {
  delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
  delete process.env.BATTLEMAP_RELAY_SECRET;
  delete process.env.SUPABASE_HYBRID_GUEST_ENABLED;
});

describe('PR05 capability rotation route (E3, M1, M2)', () => {
  it('issues a 256-bit capability once, stores only its hash, keeps revision and clears binding/ACK', async () => {
    issueDisplay(store);
    store.strings.set(tableDisplayAckKey(CODE), '{"v":1}');
    const before = control();
    const response = await send(
      capabilityPOST,
      displayCapabilityRequest(CODE, DM_ID)
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const { capability, displayGeneration } = response.body as {
      capability: string;
      displayGeneration: number;
    };
    expect(capability).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(Number.isSafeInteger(displayGeneration)).toBe(true);
    expect(displayGeneration).toBeGreaterThanOrEqual(1);
    expect(displayGeneration).toBeLessThan(1e14);
    expect(displayGeneration).not.toBe(DISPLAY_GENERATION);
    const after = control();
    expect(after.displayCapabilityHash).toBe(sha256Hex(capability));
    expect(after.displayGeneration).toBe(displayGeneration);
    expect(after.revision).toBe(before.revision);
    expect(after.presentation).toEqual(before.presentation);
    expect(after.writerFence).toBe(before.writerFence);
    expect(store.strings.has(tableDisplaySessionKey(CODE))).toBe(false);
    expect(store.strings.has(tableDisplayAckKey(CODE))).toBe(false);
    expect(
      [...store.strings.values()].some(value => value.includes(capability))
    ).toBe(false);
  });

  it('accepts an account owner/DM and rejects every other caller without echoing input', async () => {
    membership.value = {
      mode: 'account',
      principal: { role: 'dm', accountId: 'acct-dm' },
    };
    expect(
      (await send(capabilityPOST, displayCapabilityRequest(CODE, DM_ID))).status
    ).toBe(200);
    membership.value = {
      mode: 'account',
      principal: { role: 'player', accountId: 'acct-player' },
    };
    const player = await send(
      capabilityPOST,
      displayCapabilityRequest(CODE, DM_ID)
    );
    expect(player.status).toBe(403);
    membership.value = { mode: 'legacy' };
    const rejected = [
      await send(capabilityPOST, displayCapabilityRequest(CODE, 'not-the-dm')),
      await send(capabilityPOST, displayCapabilityRequest(CODE, DM_ID), {
        'x-rollkeeper-csrf': null,
      }),
      await send(capabilityPOST, displayCapabilityRequest(CODE, DM_ID), {
        origin: 'https://evil.test',
      }),
    ];
    expect(rejected.map(item => item.status)).toEqual([403, 403, 403]);
    process.env.SUPABASE_HYBRID_GUEST_ENABLED = 'true';
    expect(
      (
        await send(capabilityPOST, displayCapabilityRequest(CODE, DM_ID), {
          cookie: 'rk_guest_session=guest',
        })
      ).status
    ).toBe(403);
    delete process.env.SUPABASE_HYBRID_GUEST_ENABLED;
    const otherCampaign = await capabilityPOST(
      clientRequest(
        displayCapabilityRequest('OTHER9', DM_ID).url,
        displayCapabilityRequest('OTHER9', DM_ID).init
      ),
      { params: Promise.resolve({ code: 'OTHER9' }) }
    );
    expect(otherCampaign.status).toBe(403);
    for (const item of [...rejected, player])
      expect(item.text).not.toContain('not-the-dm');
    expect(control().displayGeneration).not.toBe(0);
  });

  it('bounds the body, needs an initialized control and is off without v1', async () => {
    const built = displayCapabilityRequest(CODE, DM_ID);
    const oversized = await send(capabilityPOST, {
      url: built.url,
      init: {
        ...built.init,
        body: JSON.stringify({ dmId: DM_ID, pad: 'x'.repeat(17_000) }),
      },
    });
    expect(oversized.status).toBe(400);
    const malformed = await send(capabilityPOST, {
      url: built.url,
      init: { ...built.init, body: '{' },
    });
    expect(malformed.status).toBe(400);
    store.strings.delete(tableControlKey(CODE));
    const missing = await send(capabilityPOST, built);
    expect(missing.status).toBe(409);
    expect(missing.body).toEqual({
      error: 'Live table is not initialized — open a Table scene first',
    });
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
    expect((await send(capabilityPOST, built)).status).toBe(503);
  });
});

describe('PR05 legacy display-key route', () => {
  it('answers 426 under v1 and never mints the plaintext key', async () => {
    const response = await send(
      displayKeyPOST,
      legacyDisplayKeyRequest(CODE, DM_ID)
    );
    expect(response.status).toBe(426);
    expect(response.body).toEqual({
      error: 'Use Open display from a Table scene or the campaign page',
    });
    expect(store.strings.get(`campaign:${CODE}:displaykey`)).toBe(DISPLAY_KEY);
  });

  it('flag off keeps the legacy key behind account-aware DM auth, origin/CSRF and a bounded body', async () => {
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
    const ok = await send(displayKeyPOST, legacyDisplayKeyRequest(CODE, DM_ID));
    expect(ok.status).toBe(200);
    expect(typeof ok.body.displayKey).toBe('string');
    expect(store.strings.get(`campaign:${CODE}:displaykey`)).toBe(
      ok.body.displayKey
    );
    expect(
      (
        await send(displayKeyPOST, legacyDisplayKeyRequest(CODE, DM_ID), {
          'x-rollkeeper-csrf': null,
        })
      ).status
    ).toBe(403);
    membership.value = {
      mode: 'account',
      principal: { role: 'player', accountId: 'acct-player' },
    };
    expect(
      (await send(displayKeyPOST, legacyDisplayKeyRequest(CODE, DM_ID))).status
    ).toBe(403);
    membership.value = { mode: 'legacy' };
    const built = legacyDisplayKeyRequest(CODE, DM_ID);
    expect(
      (
        await send(displayKeyPOST, {
          url: built.url,
          init: {
            ...built.init,
            body: JSON.stringify({ dmId: DM_ID, pad: 'x'.repeat(17_000) }),
          },
        })
      ).status
    ).toBe(400);
  });
});

describe('PR05 display descriptor route (E4, E6)', () => {
  it('binds the first nonce, returns only the visible scene and allows same-tab reload', async () => {
    issueDisplay(store, false);
    const response = await send(
      descriptorPOST,
      displayDescriptorRequest(CODE, credential)
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.body).toEqual({
      displayGeneration: DISPLAY_GENERATION,
      epoch: EPOCH,
      presentation: { sceneId: 'scene-tavern', revision: 3, blanked: false },
      scene: {
        sceneId: 'scene-tavern',
        sourceMapId: 'map-tavern',
        label: 'Tavern',
      },
    });
    expect(response.text).not.toMatch(/Forest|forest|workspace|room|secret/u);
    expect(
      JSON.parse(store.strings.get(tableDisplaySessionKey(CODE))!)
    ).toEqual({
      displayGeneration: DISPLAY_GENERATION,
      nonceHash: sha256Hex(DISPLAY_NONCE),
    });
    const reload = await send(
      descriptorPOST,
      displayDescriptorRequest(CODE, credential)
    );
    expect(reload.status).toBe(200);
  });

  it('denies a second screen, an expired/rotated/malformed link and a missing control', async () => {
    issueDisplay(store);
    const other = await send(
      descriptorPOST,
      displayDescriptorRequest(CODE, {
        capability: DISPLAY_CAPABILITY,
        nonce: 'Other5Synthetic_012345',
      })
    );
    expect(other.status).toBe(403);
    expect(other.body).toEqual(IN_USE);
    for (const bad of [
      { capability: 'B'.repeat(43), nonce: DISPLAY_NONCE },
      {
        capability: '123e4567-e89b-42d3-a456-426614174000',
        nonce: DISPLAY_NONCE,
      },
      { capability: DISPLAY_CAPABILITY, nonce: 'x' },
    ]) {
      const denied = await send(
        descriptorPOST,
        displayDescriptorRequest(CODE, bad)
      );
      expect(denied.status).toBe(403);
      expect(denied.body).toEqual(EXPIRED);
    }
    const built = displayDescriptorRequest(CODE, credential);
    const noCredential = await send(descriptorPOST, {
      url: built.url,
      init: { ...built.init, body: '{}' },
    });
    expect(noCredential.body).toEqual(EXPIRED);
    store.strings.delete(tableControlKey(CODE));
    const missing = await send(descriptorPOST, built);
    expect(missing.status).toBe(403);
    expect(missing.body).toEqual(EXPIRED);
  });

  it('projects blank, unshown and deleted scenes as null and validates origin/CSRF', async () => {
    issueDisplay(store);
    setPresentation(store, 'scene-tavern', true);
    const blank = await send(
      descriptorPOST,
      displayDescriptorRequest(CODE, credential)
    );
    expect(blank.body).toMatchObject({
      presentation: { sceneId: null, revision: 3, blanked: true },
      scene: null,
    });
    expect(blank.text).not.toContain('scene-tavern');
    setPresentation(store, 'scene-forest');
    setRegistryEntry(
      store,
      registryEntry('scene-forest', 'map-forest', 'Private Forest', 'r', {
        deleted: true,
      })
    );
    const deleted = await send(
      descriptorPOST,
      displayDescriptorRequest(CODE, credential)
    );
    expect(deleted.body).toMatchObject({
      presentation: { sceneId: null, blanked: false },
      scene: null,
    });
    expect(deleted.text).not.toMatch(/forest/iu);
    for (const headers of [
      { 'x-rollkeeper-csrf': null },
      { origin: 'https://evil.test' },
    ] as Array<Record<string, string | null>>) {
      const refused = await send(
        descriptorPOST,
        displayDescriptorRequest(CODE, credential),
        headers
      );
      expect(refused.status).toBe(403);
      expect(refused.body).toEqual(ORIGIN_FAILED);
    }
  });

  it('answers 503 when the authority read fails and is off without v1', async () => {
    issueDisplay(store);
    Object.assign(store.rawRedis, {
      eval: async () => {
        throw new Error('offline');
      },
    });
    const failed = await send(
      descriptorPOST,
      displayDescriptorRequest(CODE, credential)
    );
    expect(failed.status).toBe(503);
    expect(failed.body).toEqual({ error: 'Live authority is unavailable' });
    delete process.env.TABLE_PROTOCOL_V1_REQUIRED;
    expect(
      (await send(descriptorPOST, displayDescriptorRequest(CODE, credential)))
        .status
    ).toBe(503);
  });
});

describe('PR05 display ACK route (E7)', () => {
  it('stores an exact current tuple with server time and never trusts the client', async () => {
    issueDisplay(store);
    const response = await send(
      ackPOST,
      displayAckRequest(CODE, credential, ack())
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ receivedAt: now });
    expect(JSON.parse(store.strings.get(tableDisplayAckKey(CODE))!)).toEqual({
      v: 1,
      displayGeneration: DISPLAY_GENERATION,
      epoch: EPOCH,
      presentationRevision: 3,
      sceneId: 'scene-tavern',
      blanked: false,
      phase: 'loaded',
      receivedAt: now,
    });
  });

  it('rejects stale tuples with 409 and writes nothing', async () => {
    issueDisplay(store);
    for (const stale of [
      ack({ presentationRevision: 2 }),
      ack({ epoch: '29a12345-1234-4123-8123-123456789abc' }),
      ack({ displayGeneration: DISPLAY_GENERATION + 1 }),
      ack({ sceneId: 'scene-forest' }),
      ack({ sceneId: null, phase: 'blank' }),
      ack({ blanked: true }),
    ]) {
      const response = await send(
        ackPOST,
        displayAckRequest(CODE, credential, stale)
      );
      expect(response.status, JSON.stringify(stale)).toBe(409);
      expect(response.body).toEqual({ error: 'stale' });
    }
    setPresentation(store, 'scene-tavern', true);
    const loadedWhileBlank = await send(
      ackPOST,
      displayAckRequest(CODE, credential, ack({ sceneId: null }))
    );
    expect(loadedWhileBlank.status).toBe(409);
    expect(store.strings.has(tableDisplayAckKey(CODE))).toBe(false);
    const blankAck = await send(
      ackPOST,
      displayAckRequest(
        CODE,
        credential,
        ack({ sceneId: null, blanked: true, phase: 'blank' })
      )
    );
    expect(blankAck.status).toBe(200);
  });

  it('answers an unbound session with 409 stale and credentials with 403', async () => {
    issueDisplay(store, false);
    const unbound = await send(
      ackPOST,
      displayAckRequest(CODE, credential, ack())
    );
    expect(unbound.status).toBe(409);
    expect(unbound.body).toEqual({ error: 'stale' });
    issueDisplay(store);
    const otherNonce = await send(
      ackPOST,
      displayAckRequest(
        CODE,
        { capability: DISPLAY_CAPABILITY, nonce: 'Other5Synthetic_012345' },
        ack()
      )
    );
    expect(otherNonce.body).toEqual(IN_USE);
    const rotated = await send(
      ackPOST,
      displayAckRequest(
        CODE,
        { capability: 'R'.repeat(43), nonce: DISPLAY_NONCE },
        ack()
      )
    );
    expect(rotated.status).toBe(403);
    expect(rotated.body).toEqual(EXPIRED);
    expect(store.strings.has(tableDisplayAckKey(CODE))).toBe(false);
  });

  it('caps the body at 2 KiB and accepts exactly the ACK keys', async () => {
    issueDisplay(store);
    const built = displayAckRequest(CODE, credential, ack());
    const body = JSON.parse(built.init.body as string) as Record<
      string,
      unknown
    >;
    for (const bad of [
      { ...body, pad: 'x'.repeat(2_100) },
      { ...body, extra: true },
      { ...body, ack: { ...ack(), receivedAt: 1 } },
      { ...body, ack: { ...ack(), phase: 'displaying' } },
    ]) {
      const response = await send(ackPOST, {
        url: built.url,
        init: { ...built.init, body: JSON.stringify(bad) },
      });
      expect(response.status).toBe(400);
    }
    expect(store.strings.has(tableDisplayAckKey(CODE))).toBe(false);
  });
});

describe('PR05 DM display status route (E13)', () => {
  async function status() {
    const response = await statusGET(
      clientRequest(displayStatusUrl(CODE, DM_ID)),
      params()
    );
    return {
      status: response.status,
      body: (await response.json()) as Record<string, unknown>,
    };
  }

  it('reports none → loaded → updating → stale → none without secrets', async () => {
    issueDisplay(store);
    expect((await status()).body).toEqual({
      state: 'none',
      sceneId: null,
      ageMs: null,
    });
    await send(ackPOST, displayAckRequest(CODE, credential, ack()));
    now += 4_000;
    const loaded = await status();
    expect(loaded.body).toEqual({
      state: 'loaded',
      sceneId: 'scene-tavern',
      ageMs: 4_000,
    });
    const serialized = JSON.stringify(loaded.body);
    for (const secret of [
      DISPLAY_CAPABILITY,
      DISPLAY_NONCE,
      sha256Hex(DISPLAY_CAPABILITY),
      String(DISPLAY_GENERATION),
    ])
      expect(serialized).not.toContain(secret);
    const changed = control();
    changed.presentation.revision = 4;
    store.strings.set(tableControlKey(CODE), JSON.stringify(changed));
    expect((await status()).body.state).toBe('updating');
    now += 11_000;
    expect((await status()).body).toMatchObject({
      state: 'stale',
      ageMs: 15_000,
    });
    now += 15_000;
    expect((await status()).body.state).toBe('none');
  });

  it('reports blank and waiting tuples', async () => {
    issueDisplay(store);
    setPresentation(store, 'scene-tavern', true);
    await send(
      ackPOST,
      displayAckRequest(
        CODE,
        credential,
        ack({ sceneId: null, blanked: true, phase: 'blank' })
      )
    );
    expect((await status()).body.state).toBe('blank');
    setPresentation(store, null);
    await send(
      ackPOST,
      displayAckRequest(
        CODE,
        credential,
        ack({ sceneId: null, phase: 'blank' })
      )
    );
    expect((await status()).body).toMatchObject({
      state: 'waiting',
      sceneId: null,
    });
  });

  it('is DM-only', async () => {
    membership.value = {
      mode: 'account',
      principal: { role: 'player', accountId: 'acct-player' },
    };
    expect((await status()).status).toBe(403);
    membership.value = { mode: 'legacy' };
    const wrong = await statusGET(
      clientRequest(displayStatusUrl(CODE, 'not-the-dm')),
      params()
    );
    expect(wrong.status).toBe(403);
  });
});
