import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

vi.mock('@/utils/spellDataLoader', () => ({
  loadAllSpells: vi.fn(),
}));

import { loadAllSpells } from '@/utils/spellDataLoader';

const mockSpells = [
  { id: 'fireball-phb', name: 'Fireball', level: 3, school: 'V' },
  { id: 'shield-phb', name: 'Shield', level: 1, school: 'A' },
  { id: 'magic-missile-phb', name: 'Magic Missile', level: 1, school: 'V' },
];

describe('GET /api/spells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadAllSpells).mockResolvedValue(
      mockSpells as ReturnType<typeof mockSpells.map>
    );
  });

  it('returns all spells with total and hasMore false', async () => {
    const req = new NextRequest('http://localhost/api/spells');

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.spells).toHaveLength(3);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(false);
  });

  it('applies pagination with limit and offset', async () => {
    const req = new NextRequest('http://localhost/api/spells?limit=2&offset=0');

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.spells).toHaveLength(2);
    expect(data.spells[0].name).toBe('Fireball');
    expect(data.spells[1].name).toBe('Shield');
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(true);
  });

  it('returns remaining spells with offset', async () => {
    const req = new NextRequest('http://localhost/api/spells?limit=2&offset=2');

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.spells).toHaveLength(1);
    expect(data.spells[0].name).toBe('Magic Missile');
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(false);
  });

  it('returns hasMore false when paginated results reach the end exactly', async () => {
    const req = new NextRequest('http://localhost/api/spells?limit=3&offset=0');

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.spells).toHaveLength(3);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(false);
  });

  it('returns 500 on loader error', async () => {
    vi.mocked(loadAllSpells).mockRejectedValueOnce(
      new Error('Disk read failed')
    );

    const req = new NextRequest('http://localhost/api/spells');

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to load spell data');
  });
});
