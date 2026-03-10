import { describe, it, expect, beforeEach } from 'vitest';
import { resetRedis, getRedisStore, getRedisSet } from '@/test/mocks/redis';
import { createNextRequest } from '@/test/helpers';
import { POST } from '../route';
import { NextRequest } from 'next/server';

describe('POST /api/campaign', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('creates a campaign and returns 201 with code', async () => {
    const req = createNextRequest('/api/campaign', {
      method: 'POST',
      body: { dmId: 'dm-1', campaignName: 'Dragon Hunt' },
    });

    const res = await POST(req as NextRequest);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(data.campaign.dmId).toBe('dm-1');
    expect(data.campaign.campaignName).toBe('Dragon Hunt');
    expect(data.campaign.createdAt).toBeDefined();
  });

  it('stores campaign data in Redis', async () => {
    const req = createNextRequest('/api/campaign', {
      method: 'POST',
      body: { dmId: 'dm-1', campaignName: 'Dragon Hunt' },
    });

    const res = await POST(req as NextRequest);
    const data = await res.json();

    const stored = getRedisStore().get(`campaign:${data.code}`);
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.campaignName).toBe('Dragon Hunt');
  });

  it('initialises the players set', async () => {
    const req = createNextRequest('/api/campaign', {
      method: 'POST',
      body: { dmId: 'dm-1', campaignName: 'Dragon Hunt' },
    });

    const res = await POST(req as NextRequest);
    const data = await res.json();

    const playerSet = getRedisSet(`campaign:${data.code}:players`);
    expect(playerSet.has('__init__')).toBe(true);
  });

  it('returns 400 when dmId is missing', async () => {
    const req = createNextRequest('/api/campaign', {
      method: 'POST',
      body: { campaignName: 'Dragon Hunt' },
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(400);
  });

  it('returns 400 when campaignName is missing', async () => {
    const req = createNextRequest('/api/campaign', {
      method: 'POST',
      body: { dmId: 'dm-1' },
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(400);
  });
});
