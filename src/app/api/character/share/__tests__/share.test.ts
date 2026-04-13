import { describe, it, expect, beforeEach } from 'vitest';
import { resetRedis, getRedisStore } from '@/test/mocks/redis';
import { createNextRequest } from '@/test/helpers';
import { POST } from '../route';
import { NextRequest } from 'next/server';

const mockExport = {
  version: '1.0.0',
  exportDate: '2026-04-12T00:00:00.000Z',
  character: {
    id: 'char-abc',
    name: 'Thorin',
    race: 'Dwarf',
    class: { name: 'Fighter', subclass: '', hitDie: 'd10', spellcasting: null },
    level: 5,
  },
};

describe('POST /api/character/share', () => {
  beforeEach(() => {
    resetRedis();
  });

  it('stores character export in Redis and returns ok', async () => {
    const req = createNextRequest('/api/character/share', {
      method: 'POST',
      body: { characterId: 'char-abc', character: mockExport },
    });

    const res = await POST(req as NextRequest);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    const stored = getRedisStore().get('character:share:char-abc');
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.character.name).toBe('Thorin');
  });

  it('strips base64 avatar before storing', async () => {
    const req = createNextRequest('/api/character/share', {
      method: 'POST',
      body: {
        characterId: 'char-abc',
        character: {
          ...mockExport,
          character: {
            ...mockExport.character,
            avatar: 'data:image/png;base64,abc123',
          },
        },
      },
    });

    await POST(req as NextRequest);

    const stored = getRedisStore().get('character:share:char-abc');
    const parsed = JSON.parse(stored!);
    expect(parsed.character.avatar).toBeUndefined();
  });

  it('preserves S3 avatar URLs', async () => {
    const req = createNextRequest('/api/character/share', {
      method: 'POST',
      body: {
        characterId: 'char-abc',
        character: {
          ...mockExport,
          character: {
            ...mockExport.character,
            avatar: 'https://s3.amazonaws.com/bucket/avatar.jpg',
          },
        },
      },
    });

    await POST(req as NextRequest);

    const stored = getRedisStore().get('character:share:char-abc');
    const parsed = JSON.parse(stored!);
    expect(parsed.character.avatar).toBe(
      'https://s3.amazonaws.com/bucket/avatar.jpg'
    );
  });

  it('returns 400 when characterId is missing', async () => {
    const req = createNextRequest('/api/character/share', {
      method: 'POST',
      body: { character: mockExport },
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(400);
  });

  it('returns 400 when character is missing', async () => {
    const req = createNextRequest('/api/character/share', {
      method: 'POST',
      body: { characterId: 'char-abc' },
    });

    const res = await POST(req as NextRequest);
    expect(res.status).toBe(400);
  });
});
