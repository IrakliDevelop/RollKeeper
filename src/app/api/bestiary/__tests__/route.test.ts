import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockProcessedMonster } from '@/test/helpers';

// Mock the data loader
vi.mock('@/utils/bestiaryDataLoader', () => ({
  loadAllBestiary: vi.fn(),
}));

// Mock bestiaryFilters to exercise actual filter logic
vi.mock('@/utils/bestiaryFilters', async importOriginal => {
  return await importOriginal();
});

import { loadAllBestiary } from '@/utils/bestiaryDataLoader';
import { GET } from '../route';
import { GET as searchGET } from '../search/route';

const mockLoadAllBestiary = vi.mocked(loadAllBestiary);

function makeRequest(
  path: string,
  params?: Record<string, string>
): NextRequest {
  const url = new URL(`http://localhost${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }
  return new Request(url.toString()) as NextRequest;
}

const goblin = createMockProcessedMonster({
  id: 'goblin-mm',
  name: 'Goblin',
  size: ['Small'],
  type: 'humanoid',
  alignment: 'Neutral Evil',
  cr: '1/4',
  source: 'MM',
  resistances: 'None',
  immunities: 'None',
  legendaryActionCount: 0,
  legendaryActions: undefined,
  traits: [],
  actions: [],
});

const dragon = createMockProcessedMonster({
  id: 'adult-red-dragon-mm',
  name: 'Adult Red Dragon',
  size: ['Huge'],
  type: 'dragon',
  alignment: 'Chaotic Evil',
  cr: '17',
  source: 'MM',
  resistances: 'None',
  immunities: 'fire',
  legendaryActionCount: 3,
  legendaryActions: [
    { name: 'Detect', text: 'The dragon makes a Perception check.' },
    { name: 'Tail Attack', text: 'The dragon makes a tail attack.' },
    { name: 'Wing Attack', text: 'Costs 2 actions.' },
  ],
  traits: [],
  actions: [{ name: 'Spellcasting', text: 'The dragon casts a spell.' }],
});

const lich = createMockProcessedMonster({
  id: 'lich-mm',
  name: 'Lich',
  size: ['Medium'],
  type: 'undead',
  alignment: 'Neutral Evil',
  cr: '21',
  source: 'MM',
  resistances: 'cold, lightning, necrotic',
  immunities:
    'poison; bludgeoning, piercing, and slashing from nonmagical attacks',
  legendaryActionCount: 3,
  legendaryActions: [{ name: 'Cantrip', text: 'The lich casts a cantrip.' }],
  traits: [
    { name: 'Spellcasting', text: 'The lich is an 18th-level spellcaster.' },
  ],
  actions: [],
});

const mockMonsters = [goblin, dragon, lich];

describe('GET /api/bestiary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns all monsters with total and hasMore=false when no pagination', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.monsters).toHaveLength(3);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(false);
  });

  it('returns paginated results when limit and offset are provided', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary', { limit: '2', offset: '0' });
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.monsters).toHaveLength(2);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(true);
  });

  it('returns remaining items on the last page', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary', { limit: '2', offset: '2' });
    const res = await GET(req);
    const data = await res.json();

    expect(data.monsters).toHaveLength(1);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(false);
  });

  it('returns hasMore=false when offset+limit equals total', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary', { limit: '3', offset: '0' });
    const res = await GET(req);
    const data = await res.json();

    expect(data.hasMore).toBe(false);
    expect(data.monsters).toHaveLength(3);
  });

  it('returns 500 when the data loader throws', async () => {
    mockLoadAllBestiary.mockRejectedValue(new Error('File read error'));

    const req = makeRequest('/api/bestiary');
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to load bestiary data');
  });
});

describe('GET /api/bestiary/search', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns all monsters with default pagination when no filters', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search');
    const res = await searchGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(false);
    expect(data.filters).toBeDefined();
  });

  it('filters by search query (name match)', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search', { q: 'goblin' });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.total).toBe(1);
    expect(data.monsters[0].name).toBe('Goblin');
  });

  it('filters by type', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search', { types: 'dragon' });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.total).toBe(1);
    expect(data.monsters[0].name).toBe('Adult Red Dragon');
  });

  it('filters by CR min', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    // CR >= 17 → dragon (17) and lich (21)
    const req = makeRequest('/api/bestiary/search', { crMin: '17' });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.total).toBe(2);
    const names = data.monsters.map((m: { name: string }) => m.name);
    expect(names).toContain('Adult Red Dragon');
    expect(names).toContain('Lich');
  });

  it('filters by CR max', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    // CR <= 1 → goblin (1/4)
    const req = makeRequest('/api/bestiary/search', { crMax: '1' });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.total).toBe(1);
    expect(data.monsters[0].name).toBe('Goblin');
  });

  it('filters by CR range', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    // 15 <= CR <= 18 → only dragon (17)
    const req = makeRequest('/api/bestiary/search', {
      crMin: '15',
      crMax: '18',
    });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.total).toBe(1);
    expect(data.monsters[0].name).toBe('Adult Red Dragon');
  });

  it('returns empty results when no monsters match filter', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search', { q: 'beholder' });
    const res = await searchGET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total).toBe(0);
    expect(data.monsters).toHaveLength(0);
    expect(data.hasMore).toBe(false);
  });

  it('applies pagination to filtered results', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    // All monsters, page of 2
    const req = makeRequest('/api/bestiary/search', {
      limit: '2',
      offset: '0',
    });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.monsters).toHaveLength(2);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(true);
  });

  it('hasMore=false on last page of search results', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search', {
      limit: '2',
      offset: '2',
    });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.monsters).toHaveLength(1);
    expect(data.hasMore).toBe(false);
  });

  it('filters hasLegendaryActions=true', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search', {
      hasLegendaryActions: 'true',
    });
    const res = await searchGET(req);
    const data = await res.json();

    // dragon and lich have legendaryActionCount > 0
    expect(data.total).toBe(2);
    const names = data.monsters.map((m: { name: string }) => m.name);
    expect(names).toContain('Adult Red Dragon');
    expect(names).toContain('Lich');
  });

  it('filters hasDamageResistances=true', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search', {
      hasDamageResistances: 'true',
    });
    const res = await searchGET(req);
    const data = await res.json();

    // Only lich has non-None resistances
    expect(data.total).toBe(1);
    expect(data.monsters[0].name).toBe('Lich');
  });

  it('includes filters object in response', async () => {
    mockLoadAllBestiary.mockResolvedValue(mockMonsters);

    const req = makeRequest('/api/bestiary/search', {
      q: 'goblin',
      types: 'humanoid',
      crMin: '0',
      crMax: '5',
    });
    const res = await searchGET(req);
    const data = await res.json();

    expect(data.filters.searchQuery).toBe('goblin');
    expect(data.filters.types).toContain('humanoid');
    expect(data.filters.crRange.min).toBe(0);
    expect(data.filters.crRange.max).toBe(5);
  });

  it('returns 500 when the data loader throws', async () => {
    mockLoadAllBestiary.mockRejectedValue(new Error('File read error'));

    const req = makeRequest('/api/bestiary/search');
    const res = await searchGET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Failed to search bestiary data');
  });
});
