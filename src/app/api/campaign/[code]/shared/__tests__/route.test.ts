import { describe, it, expect, beforeEach } from 'vitest';
import { resetRedis, seedRedis, getRedisStore } from '@/test/mocks/redis';
import {
  createNextRequest,
  createRouteParams,
  createMockCampaignData,
} from '@/test/helpers';
// Note: GET tests use NextRequest directly (requires nextUrl.searchParams).
// POST/DELETE tests use createNextRequest (plain Request with json body).
import { GET, POST, DELETE } from '../route';
import { NextRequest } from 'next/server';
import type {
  SharedCampaignState,
  SharedCalendar,
  DmMessage,
  DmEffect,
  ItemTransfer,
  SharedCustomCounter,
} from '@/types/sharedState';

// Shared key helpers (mirrors the mock)
const campaignSharedKey = (code: string, feature: string) =>
  `campaign:${code}:shared:${feature}`;
const campaignMessagesKey = (code: string, playerId: string) =>
  `campaign:${code}:messages:${playerId}`;
const campaignEffectsKey = (code: string, playerId: string) =>
  `campaign:${code}:effects:${playerId}`;
const campaignTransfersKey = (code: string, playerId: string) =>
  `campaign:${code}:transfers:${playerId}`;
const campaignKey = (code: string) => `campaign:${code}`;

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeCalendar(moonCount = 2): SharedCalendar {
  return {
    config: {
      name: 'Harptos',
      monthsPerYear: 12,
      daysPerMonth: 30,
      hoursPerDay: 24,
      minutesPerHour: 60,
      months: [],
      moons: Array.from({ length: moonCount }, (_, i) => ({
        name: `Moon ${i + 1}`,
        period: 28,
        offset: 0,
      })),
    },
    currentTime: 0,
    startTime: 0,
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeMessage(id = 'msg-1'): DmMessage {
  return {
    id,
    title: 'Test Message',
    content: '<p>Hello player</p>',
    sentAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeEffect(id = 'eff-1'): DmEffect {
  return {
    id,
    name: 'Poisoned',
    action: 'add',
    appliedAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeTransfer(id = 'xfr-1'): ItemTransfer {
  return {
    id,
    item: {
      id: 'item-1',
      name: 'Potion of Healing',
      quantity: 1,
      weight: 0.5,
      description: '',
      equipped: false,
      attunement: false,
      requiresAttunement: false,
    } as ItemTransfer['item'],
    fromPlayerName: 'Alice',
    fromCharacterName: 'Thorn',
    fromType: 'player',
    sentAt: '2025-01-01T00:00:00.000Z',
  };
}

function makeCounter(playerId: string, value: number): SharedCustomCounter {
  return {
    label: 'Desperation Points',
    counters: { [playerId]: value },
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe('GET /api/campaign/[code]/shared', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('returns empty state for a new campaign (no playerId)', async () => {
    const req = new NextRequest('http://localhost/api/campaign/TEST/shared');
    const res = await GET(req, createRouteParams({ code: 'TEST' }));

    expect(res.status).toBe(200);
    const data: SharedCampaignState = await res.json();
    expect(data.calendar).toBeNull();
    expect(data.messages).toEqual([]);
    expect(data.dmEffects).toEqual([]);
    expect(data.customCounter).toBeNull();
    expect(data.transfers).toEqual([]);
  });

  it('returns empty state for a new campaign with playerId', async () => {
    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?playerId=player-1'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    expect(data.messages).toEqual([]);
    expect(data.dmEffects).toEqual([]);
    expect(data.customCounter).toBeNull();
    expect(data.transfers).toEqual([]);
  });

  it('returns calendar with moons stripped for player role', async () => {
    seedRedis(campaignSharedKey('TEST', 'calendar'), makeCalendar(2));

    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?role=player&playerId=player-1'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    expect(data.calendar).not.toBeNull();
    expect(data.calendar!.config.moons).toEqual([]);
  });

  it('returns full calendar (with moons) for DM role', async () => {
    seedRedis(campaignSharedKey('TEST', 'calendar'), makeCalendar(2));

    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?role=dm'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    expect(data.calendar).not.toBeNull();
    expect(data.calendar!.config.moons).toHaveLength(2);
  });

  it('returns messages for a player', async () => {
    const msg = makeMessage('msg-1');
    seedRedis(campaignMessagesKey('TEST', 'player-1'), [msg]);

    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?playerId=player-1'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe('msg-1');
  });

  it('returns DM effects for a player', async () => {
    const effect = makeEffect('eff-1');
    seedRedis(campaignEffectsKey('TEST', 'player-1'), [effect]);

    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?playerId=player-1'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    expect(data.dmEffects).toHaveLength(1);
    expect(data.dmEffects[0].id).toBe('eff-1');
  });

  it('returns item transfers for a player', async () => {
    const transfer = makeTransfer('xfr-1');
    seedRedis(campaignTransfersKey('TEST', 'player-1'), [transfer]);

    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?playerId=player-1'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    expect(data.transfers).toHaveLength(1);
    expect(data.transfers[0].id).toBe('xfr-1');
  });

  it('returns custom counter value for a player', async () => {
    seedRedis(
      campaignSharedKey('TEST', 'counters'),
      makeCounter('player-1', 3)
    );

    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?playerId=player-1'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    expect(data.customCounter).not.toBeNull();
    expect(data.customCounter!.label).toBe('Desperation Points');
    expect(data.customCounter!.value).toBe(3);
  });

  it('returns customCounter with value 0 when counter has no entry for the player but label exists', async () => {
    // The route returns customCounter when label is present, even if player's value defaults to 0
    seedRedis(
      campaignSharedKey('TEST', 'counters'),
      makeCounter('player-2', 5)
    );

    const req = new NextRequest(
      'http://localhost/api/campaign/TEST/shared?playerId=player-1'
    );
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    // counter exists with label but player-1 has no entry → value defaults to 0, customCounter still returned
    expect(data.customCounter).not.toBeNull();
    expect(data.customCounter!.value).toBe(0);
    expect(data.customCounter!.label).toBe('Desperation Points');
  });

  it('returns empty messages/effects/transfers when playerId is missing', async () => {
    seedRedis(campaignMessagesKey('TEST', 'player-1'), [makeMessage()]);
    seedRedis(campaignEffectsKey('TEST', 'player-1'), [makeEffect()]);

    const req = new NextRequest('http://localhost/api/campaign/TEST/shared');
    const res = await GET(req, createRouteParams({ code: 'TEST' }));
    const data: SharedCampaignState = await res.json();

    // No playerId → player-scoped data not fetched
    expect(data.messages).toEqual([]);
    expect(data.dmEffects).toEqual([]);
    expect(data.transfers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST tests
// ---------------------------------------------------------------------------

describe('POST /api/campaign/[code]/shared', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('returns 400 when feature is missing', async () => {
    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: { data: {}, dmId: 'dm-1' },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when data is missing', async () => {
    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: { feature: 'calendar', dmId: 'dm-1' },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when dmId is missing for non-transfer features', async () => {
    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: { feature: 'calendar', data: makeCalendar() },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('stores calendar under shared:calendar key', async () => {
    seedRedis(campaignKey('TEST'), createMockCampaignData());
    const calendar = makeCalendar(1);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: { feature: 'calendar', data: calendar, dmId: 'dm-test-123' },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const stored = getRedisStore().get(campaignSharedKey('TEST', 'calendar'));
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.config.moons).toHaveLength(1);
  });

  it('sends a DM message to multiple players', async () => {
    seedRedis(campaignKey('TEST'), createMockCampaignData());
    const message = makeMessage('msg-broadcast');

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'message',
        data: { message, playerIds: ['player-1', 'player-2'] },
        dmId: 'dm-test-123',
      },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);

    const p1Raw = getRedisStore().get(campaignMessagesKey('TEST', 'player-1'));
    const p2Raw = getRedisStore().get(campaignMessagesKey('TEST', 'player-2'));
    expect(p1Raw).toBeDefined();
    expect(p2Raw).toBeDefined();

    const p1Messages: DmMessage[] = JSON.parse(p1Raw!);
    const p2Messages: DmMessage[] = JSON.parse(p2Raw!);
    expect(p1Messages[0].id).toBe('msg-broadcast');
    expect(p2Messages[0].id).toBe('msg-broadcast');
  });

  it('appends message to existing queue', async () => {
    seedRedis(campaignKey('TEST'), createMockCampaignData());
    seedRedis(campaignMessagesKey('TEST', 'player-1'), [
      makeMessage('msg-existing'),
    ]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'message',
        data: { message: makeMessage('msg-new'), playerIds: ['player-1'] },
        dmId: 'dm-test-123',
      },
    });
    await POST(req as NextRequest, createRouteParams({ code: 'TEST' }));

    const raw = getRedisStore().get(campaignMessagesKey('TEST', 'player-1'))!;
    const messages: DmMessage[] = JSON.parse(raw);
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe('msg-existing');
    expect(messages[1].id).toBe('msg-new');
  });

  it('returns 400 for message feature when playerIds is empty', async () => {
    seedRedis(campaignKey('TEST'), createMockCampaignData());

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'message',
        data: { message: makeMessage(), playerIds: [] },
        dmId: 'dm-test-123',
      },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('sends DM effects to a player', async () => {
    seedRedis(campaignKey('TEST'), createMockCampaignData());
    const effects = [makeEffect('eff-1'), makeEffect('eff-2')];

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'effects',
        data: { playerId: 'player-1', effects },
        dmId: 'dm-test-123',
      },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);

    const raw = getRedisStore().get(campaignEffectsKey('TEST', 'player-1'))!;
    const stored: DmEffect[] = JSON.parse(raw);
    expect(stored).toHaveLength(2);
    expect(stored[0].id).toBe('eff-1');
  });

  it('deletes effects key when effects array is empty', async () => {
    seedRedis(campaignKey('TEST'), createMockCampaignData());
    seedRedis(campaignEffectsKey('TEST', 'player-1'), [makeEffect()]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'effects',
        data: { playerId: 'player-1', effects: [] },
        dmId: 'dm-test-123',
      },
    });
    await POST(req as NextRequest, createRouteParams({ code: 'TEST' }));

    expect(getRedisStore().has(campaignEffectsKey('TEST', 'player-1'))).toBe(
      false
    );
  });

  it('returns 400 for effects feature when playerId is missing', async () => {
    seedRedis(campaignKey('TEST'), createMockCampaignData());

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'effects',
        data: { effects: [makeEffect()] },
        dmId: 'dm-test-123',
      },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('sends an item transfer to a player', async () => {
    const transfer = makeTransfer('xfr-1');

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'item_transfer',
        data: { transfer, playerId: 'player-1' },
        // item_transfer does not require dmId
      },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);

    const raw = getRedisStore().get(campaignTransfersKey('TEST', 'player-1'))!;
    const stored: ItemTransfer[] = JSON.parse(raw);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('xfr-1');
  });

  it('appends item transfer to existing queue', async () => {
    seedRedis(campaignTransfersKey('TEST', 'player-1'), [
      makeTransfer('xfr-old'),
    ]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'item_transfer',
        data: { transfer: makeTransfer('xfr-new'), playerId: 'player-1' },
      },
    });
    await POST(req as NextRequest, createRouteParams({ code: 'TEST' }));

    const raw = getRedisStore().get(campaignTransfersKey('TEST', 'player-1'))!;
    const stored: ItemTransfer[] = JSON.parse(raw);
    expect(stored).toHaveLength(2);
    expect(stored[1].id).toBe('xfr-new');
  });

  it('returns 400 for item_transfer when transfer is missing', async () => {
    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'item_transfer',
        data: { playerId: 'player-1' },
      },
    });
    const res = await POST(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('updates dmId on campaign record when dmId has drifted', async () => {
    const originalCampaign = createMockCampaignData({ dmId: 'old-dm-id' });
    seedRedis(campaignKey('TEST'), originalCampaign);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'calendar',
        data: makeCalendar(),
        dmId: 'new-dm-id',
      },
    });
    await POST(req as NextRequest, createRouteParams({ code: 'TEST' }));

    const raw = getRedisStore().get(campaignKey('TEST'))!;
    const updated = JSON.parse(raw);
    expect(updated.dmId).toBe('new-dm-id');
  });

  it('does not modify campaign record when dmId matches', async () => {
    seedRedis(
      campaignKey('TEST'),
      createMockCampaignData({ dmId: 'dm-test-123' })
    );

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'POST',
      body: {
        feature: 'calendar',
        data: makeCalendar(),
        dmId: 'dm-test-123',
      },
    });
    await POST(req as NextRequest, createRouteParams({ code: 'TEST' }));

    const raw = getRedisStore().get(campaignKey('TEST'))!;
    const campaign = JSON.parse(raw);
    expect(campaign.dmId).toBe('dm-test-123');
  });
});

// ---------------------------------------------------------------------------
// DELETE tests
// ---------------------------------------------------------------------------

describe('DELETE /api/campaign/[code]/shared', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('returns 400 when playerId is missing', async () => {
    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { messageId: 'msg-1' },
    });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when messageId is missing for default (message) type', async () => {
    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1' },
    });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(400);
  });

  it('acknowledges (removes) a specific message by id', async () => {
    seedRedis(campaignMessagesKey('TEST', 'player-1'), [
      makeMessage('msg-1'),
      makeMessage('msg-2'),
    ]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1', messageId: 'msg-1' },
    });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);
    const raw = getRedisStore().get(campaignMessagesKey('TEST', 'player-1'))!;
    const remaining: DmMessage[] = JSON.parse(raw);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('msg-2');
  });

  it('deletes messages key when last message is acknowledged', async () => {
    seedRedis(campaignMessagesKey('TEST', 'player-1'), [makeMessage('msg-1')]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1', messageId: 'msg-1' },
    });
    await DELETE(req as NextRequest, createRouteParams({ code: 'TEST' }));

    expect(getRedisStore().has(campaignMessagesKey('TEST', 'player-1'))).toBe(
      false
    );
  });

  it('succeeds gracefully when messages key does not exist', async () => {
    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1', messageId: 'msg-ghost' },
    });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );
    expect(res.status).toBe(200);
  });

  it('clears all DM effects for a player (type=effects)', async () => {
    seedRedis(campaignEffectsKey('TEST', 'player-1'), [makeEffect()]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1', type: 'effects' },
    });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);
    expect(getRedisStore().has(campaignEffectsKey('TEST', 'player-1'))).toBe(
      false
    );
  });

  it('clears all transfers for a player when no transferId provided (type=transfers)', async () => {
    seedRedis(campaignTransfersKey('TEST', 'player-1'), [
      makeTransfer('xfr-1'),
      makeTransfer('xfr-2'),
    ]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1', type: 'transfers' },
    });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);
    expect(getRedisStore().has(campaignTransfersKey('TEST', 'player-1'))).toBe(
      false
    );
  });

  it('removes a specific transfer by transferId (type=transfers)', async () => {
    seedRedis(campaignTransfersKey('TEST', 'player-1'), [
      makeTransfer('xfr-1'),
      makeTransfer('xfr-2'),
    ]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1', type: 'transfers', transferId: 'xfr-1' },
    });
    const res = await DELETE(
      req as NextRequest,
      createRouteParams({ code: 'TEST' })
    );

    expect(res.status).toBe(200);
    const raw = getRedisStore().get(campaignTransfersKey('TEST', 'player-1'))!;
    const remaining: ItemTransfer[] = JSON.parse(raw);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('xfr-2');
  });

  it('deletes transfers key when last transfer is removed', async () => {
    seedRedis(campaignTransfersKey('TEST', 'player-1'), [
      makeTransfer('xfr-1'),
    ]);

    const req = createNextRequest('/api/campaign/TEST/shared', {
      method: 'DELETE',
      body: { playerId: 'player-1', type: 'transfers', transferId: 'xfr-1' },
    });
    await DELETE(req as NextRequest, createRouteParams({ code: 'TEST' }));

    expect(getRedisStore().has(campaignTransfersKey('TEST', 'player-1'))).toBe(
      false
    );
  });
});
