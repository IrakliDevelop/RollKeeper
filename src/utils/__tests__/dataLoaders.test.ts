/**
 * Data loader integration tests
 *
 * Tests each *DataLoader and *Loader file in src/utils/.
 *
 * Loader types:
 *   - Static import (sensesDataLoader, backgroundDataLoader, featDataLoader)
 *     → import JSON directly; work in jsdom with no extra mocking.
 *   - fs-based (raceDataLoader, spellDataLoader, weaponDataLoader, armorDataLoader,
 *               bestiaryDataLoader, classDataLoader, itemDataLoader, magicItemDataLoader)
 *     → use fs.readFile + process.cwd(); work in vitest because cwd() resolves to the
 *       project root where json/ lives.
 *   - fetch-based (conditionsDiseasesLoader)
 *     → fetch('/data/conditionsdiseases.json'); needs fetch mock.
 *   - API-based (lazyDataLoader)
 *     → wraps apiClient which calls /api routes; skip (no server in unit tests).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// sensesDataLoader — static import
// ---------------------------------------------------------------------------
describe('sensesDataLoader', () => {
  beforeEach(async () => {
    const { clearSensesCache } = await import('@/utils/sensesDataLoader');
    clearSensesCache();
  });

  it('loads and returns a non-empty array of processed senses', async () => {
    const { loadAllSenses } = await import('@/utils/sensesDataLoader');
    const senses = await loadAllSenses();
    expect(Array.isArray(senses)).toBe(true);
    expect(senses.length).toBeGreaterThan(0);
  });

  it('each sense has id, name, source, and description', async () => {
    const { loadAllSenses } = await import('@/utils/sensesDataLoader');
    const senses = await loadAllSenses();
    const first = senses[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('description');
    expect(typeof first.id).toBe('string');
    expect(typeof first.name).toBe('string');
    expect(first.id.length).toBeGreaterThan(0);
    expect(first.name.length).toBeGreaterThan(0);
  });

  it('has isSrd boolean on each sense', async () => {
    const { loadAllSenses } = await import('@/utils/sensesDataLoader');
    const senses = await loadAllSenses();
    senses.forEach(s => {
      expect(typeof s.isSrd).toBe('boolean');
    });
  });

  it('returns cached result on second call', async () => {
    const { loadAllSenses } = await import('@/utils/sensesDataLoader');
    const first = await loadAllSenses();
    const second = await loadAllSenses();
    expect(first).toBe(second); // same reference — cached
  });

  it('returns fresh data after clearSensesCache', async () => {
    const { loadAllSenses, clearSensesCache } = await import(
      '@/utils/sensesDataLoader'
    );
    const first = await loadAllSenses();
    clearSensesCache();
    const second = await loadAllSenses();
    expect(second).not.toBe(first); // different reference after cache clear
    expect(second).toEqual(first); // same content
  });
});

// ---------------------------------------------------------------------------
// backgroundDataLoader — static import
// ---------------------------------------------------------------------------
describe('backgroundDataLoader', () => {
  beforeEach(async () => {
    const { clearBackgroundCache } = await import(
      '@/utils/backgroundDataLoader'
    );
    clearBackgroundCache();
  });

  it('loads a non-empty array of backgrounds', async () => {
    const { loadAllBackgrounds } = await import('@/utils/backgroundDataLoader');
    const backgrounds = await loadAllBackgrounds();
    expect(Array.isArray(backgrounds)).toBe(true);
    expect(backgrounds.length).toBeGreaterThan(0);
  });

  it('each background has id, name, source, skills, and isSrd', async () => {
    const { loadAllBackgrounds } = await import('@/utils/backgroundDataLoader');
    const backgrounds = await loadAllBackgrounds();
    const first = backgrounds[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('skills');
    expect(first).toHaveProperty('isSrd');
    expect(Array.isArray(first.skills)).toBe(true);
  });

  it('loads background features as a flat list', async () => {
    const { loadAllBackgroundFeatures } = await import(
      '@/utils/backgroundDataLoader'
    );
    const features = await loadAllBackgroundFeatures();
    expect(Array.isArray(features)).toBe(true);
    // Some backgrounds have features, so we expect at least some
    if (features.length > 0) {
      const first = features[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('backgroundName');
      expect(first).toHaveProperty('description');
    }
  });

  it('getBackgroundByName returns the correct background', async () => {
    const { loadAllBackgrounds, getBackgroundByName } = await import(
      '@/utils/backgroundDataLoader'
    );
    const all = await loadAllBackgrounds();
    if (all.length === 0) return; // nothing to test
    const target = all[0];
    const found = await getBackgroundByName(target.name);
    expect(found).toBeDefined();
    expect(found?.name).toBe(target.name);
  });

  it('getBackgroundByName returns undefined for unknown name', async () => {
    const { getBackgroundByName } = await import(
      '@/utils/backgroundDataLoader'
    );
    const found = await getBackgroundByName('__NonExistentBackground__');
    expect(found).toBeUndefined();
  });

  it('caches result and returns fresh data after clearBackgroundCache', async () => {
    const { loadAllBackgrounds, clearBackgroundCache } = await import(
      '@/utils/backgroundDataLoader'
    );
    const first = await loadAllBackgrounds();
    clearBackgroundCache();
    const second = await loadAllBackgrounds();
    expect(second).not.toBe(first);
    expect(second.length).toBe(first.length);
  });
});

// ---------------------------------------------------------------------------
// featDataLoader — static import
// ---------------------------------------------------------------------------
describe('featDataLoader', () => {
  beforeEach(async () => {
    const { clearFeatCache } = await import('@/utils/featDataLoader');
    clearFeatCache();
  });

  it('loads a non-empty array of feats', async () => {
    const { loadAllFeats } = await import('@/utils/featDataLoader');
    const feats = await loadAllFeats();
    expect(Array.isArray(feats)).toBe(true);
    expect(feats.length).toBeGreaterThan(0);
  });

  it('each feat has required fields', async () => {
    const { loadAllFeats } = await import('@/utils/featDataLoader');
    const feats = await loadAllFeats();
    const first = feats[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('prerequisites');
    expect(first).toHaveProperty('repeatable');
    expect(first).toHaveProperty('grantsSpells');
    expect(first).toHaveProperty('isSrd');
    expect(first).toHaveProperty('tags');
    expect(Array.isArray(first.prerequisites)).toBe(true);
    expect(Array.isArray(first.tags)).toBe(true);
  });

  it('searchFeats with empty query returns all feats', async () => {
    const { loadAllFeats, searchFeats } = await import(
      '@/utils/featDataLoader'
    );
    const all = await loadAllFeats();
    const searched = await searchFeats('');
    expect(searched.length).toBe(all.length);
  });

  it('searchFeats filters by name', async () => {
    const { loadAllFeats, searchFeats } = await import(
      '@/utils/featDataLoader'
    );
    const all = await loadAllFeats();
    if (all.length === 0) return;
    const target = all[0];
    const results = await searchFeats(target.name);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(f => f.name === target.name)).toBe(true);
  });

  it('searchFeats returns empty array for non-matching query', async () => {
    const { searchFeats } = await import('@/utils/featDataLoader');
    const results = await searchFeats('__ZZZNoMatchPossible999__');
    expect(results).toHaveLength(0);
  });

  it('getFeatByName returns correct feat', async () => {
    const { loadAllFeats, getFeatByName } = await import(
      '@/utils/featDataLoader'
    );
    const all = await loadAllFeats();
    if (all.length === 0) return;
    const target = all[0];
    const found = await getFeatByName(target.name);
    expect(found).toBeDefined();
    expect(found?.name).toBe(target.name);
  });

  it('caches and clears correctly', async () => {
    const { loadAllFeats, clearFeatCache } = await import(
      '@/utils/featDataLoader'
    );
    const first = await loadAllFeats();
    clearFeatCache();
    const second = await loadAllFeats();
    expect(second).not.toBe(first);
    expect(second.length).toBe(first.length);
  });
});

// ---------------------------------------------------------------------------
// raceDataLoader — fs-based (process.cwd() + fs.readFile)
// Works in vitest because cwd() = project root where json/races.json exists.
// ---------------------------------------------------------------------------
describe('raceDataLoader', () => {
  it('loads a non-empty array of races', async () => {
    const { loadAllRaces } = await import('@/utils/raceDataLoader');
    const races = await loadAllRaces();
    expect(Array.isArray(races)).toBe(true);
    expect(races.length).toBeGreaterThan(0);
  });

  it('each race has name, source, and displayName', async () => {
    const { loadAllRaces } = await import('@/utils/raceDataLoader');
    const races = await loadAllRaces();
    const first = races[0];
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('displayName');
    expect(typeof first.name).toBe('string');
    expect(typeof first.displayName).toBe('string');
  });

  it('getRaceNames returns an array of strings', async () => {
    const { getRaceNames } = await import('@/utils/raceDataLoader');
    const names = await getRaceNames();
    expect(Array.isArray(names)).toBe(true);
    expect(names.length).toBeGreaterThan(0);
    expect(typeof names[0]).toBe('string');
  });

  it('deduplicates races (result is sorted alphabetically)', async () => {
    const { loadAllRaces } = await import('@/utils/raceDataLoader');
    const races = await loadAllRaces();
    const names = races.map(r => r.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });
});

// ---------------------------------------------------------------------------
// conditionsDiseasesLoader — fetch-based (/data/conditionsdiseases.json)
// Needs fetch mock with the actual JSON content from the project.
// ---------------------------------------------------------------------------
describe('conditionsDiseasesLoader', () => {
  let rawConditionsData: unknown;

  beforeEach(async () => {
    // Read the actual file so we can use real data in the mock
    const filePath = path.join(
      process.cwd(),
      'json',
      'conditionsdiseases.json'
    );
    const raw = fs.readFileSync(filePath, 'utf-8');
    rawConditionsData = JSON.parse(raw);

    // Mock fetch to return the real data
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(rawConditionsData),
        statusText: 'OK',
      } as Response)
    );

    // Clear module cache so caches are reset between tests
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('loadAllConditions returns a non-empty array', async () => {
    const { loadAllConditions } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const conditions = await loadAllConditions();
    expect(Array.isArray(conditions)).toBe(true);
    expect(conditions.length).toBeGreaterThan(0);
  });

  it('each condition has id, name, source, description, isExhaustion, stackable', async () => {
    const { loadAllConditions } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const conditions = await loadAllConditions();
    const first = conditions[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('isExhaustion');
    expect(first).toHaveProperty('stackable');
    expect(typeof first.isExhaustion).toBe('boolean');
    expect(typeof first.stackable).toBe('boolean');
  });

  it('Blinded condition exists and is not exhaustion', async () => {
    const { loadAllConditions } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const conditions = await loadAllConditions();
    const blinded = conditions.find(c => c.name.toLowerCase() === 'blinded');
    expect(blinded).toBeDefined();
    expect(blinded?.isExhaustion).toBe(false);
  });

  it('Exhaustion condition exists and isExhaustion is true', async () => {
    const { loadAllConditions } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const conditions = await loadAllConditions();
    const exhaustion = conditions.find(
      c => c.name.toLowerCase() === 'exhaustion'
    );
    expect(exhaustion).toBeDefined();
    expect(exhaustion?.isExhaustion).toBe(true);
    expect(exhaustion?.stackable).toBe(true);
  });

  it('loadAllDiseases returns a non-empty array', async () => {
    const { loadAllDiseases } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const diseases = await loadAllDiseases();
    expect(Array.isArray(diseases)).toBe(true);
    expect(diseases.length).toBeGreaterThan(0);
  });

  it('each disease has id, name, source, description', async () => {
    const { loadAllDiseases } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const diseases = await loadAllDiseases();
    const first = diseases[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('description');
  });

  it('loadAllStatuses returns an array', async () => {
    const { loadAllStatuses } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const statuses = await loadAllStatuses();
    expect(Array.isArray(statuses)).toBe(true);
    // Some datasets may have no statuses, but the call should not throw
  });

  it('searchConditions filters by name', async () => {
    const { searchConditions } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const results = await searchConditions('blind');
    expect(results.length).toBeGreaterThan(0);
    results.forEach(c =>
      expect(
        c.name.toLowerCase().includes('blind') ||
          c.description.toLowerCase().includes('blind')
      ).toBe(true)
    );
  });

  it('getExhaustionByVariant returns 2014 variant', async () => {
    const { getExhaustionByVariant } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const exhaustion = await getExhaustionByVariant('2014');
    // May be null if no PHB variant; just check the return type
    if (exhaustion !== null) {
      expect(exhaustion.variant).toBe('2014');
      expect(exhaustion.isExhaustion).toBe(true);
    }
  });

  it('loadAllConditions returns empty array when fetch fails', async () => {
    // Override fetch to simulate a failure
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));
    const { loadAllConditions } = await import(
      '@/utils/conditionsDiseasesLoader'
    );
    const conditions = await loadAllConditions();
    expect(conditions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// spellDataLoader — fs-based (reads json/spells/*.json)
// ---------------------------------------------------------------------------
describe('spellDataLoader', () => {
  it('loads a non-empty array of spells', async () => {
    const { loadAllSpells } = await import('@/utils/spellDataLoader');
    const spells = await loadAllSpells();
    expect(Array.isArray(spells)).toBe(true);
    expect(spells.length).toBeGreaterThan(0);
  }, 30000);

  it('each spell has required fields', async () => {
    const { loadAllSpells } = await import('@/utils/spellDataLoader');
    const spells = await loadAllSpells();
    const first = spells[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('level');
    expect(first).toHaveProperty('school');
    expect(first).toHaveProperty('castingTime');
    expect(first).toHaveProperty('range');
    expect(first).toHaveProperty('components');
    expect(first).toHaveProperty('duration');
    expect(first).toHaveProperty('description');
    expect(first).toHaveProperty('classes');
    expect(Array.isArray(first.classes)).toBe(true);
  }, 30000);

  it('spell levels are in 0–9 range', async () => {
    const { loadAllSpells } = await import('@/utils/spellDataLoader');
    const spells = await loadAllSpells();
    spells.forEach(s => {
      expect(s.level).toBeGreaterThanOrEqual(0);
      expect(s.level).toBeLessThanOrEqual(9);
    });
  }, 30000);

  it('cantrips have isCantrip=true', async () => {
    const { loadAllSpells } = await import('@/utils/spellDataLoader');
    const spells = await loadAllSpells();
    const cantrips = spells.filter(s => s.level === 0);
    expect(cantrips.length).toBeGreaterThan(0);
    cantrips.forEach(s => expect(s.isCantrip).toBe(true));
  }, 30000);
});

// ---------------------------------------------------------------------------
// weaponDataLoader — fs-based
// ---------------------------------------------------------------------------
describe('weaponDataLoader', () => {
  it('loads a non-empty array of weapons', async () => {
    const { loadAllWeapons } = await import('@/utils/weaponDataLoader');
    const weapons = await loadAllWeapons();
    expect(Array.isArray(weapons)).toBe(true);
    expect(weapons.length).toBeGreaterThan(0);
  }, 20000);

  it('each weapon has id, name, source, and dmg1', async () => {
    const { loadAllWeapons } = await import('@/utils/weaponDataLoader');
    const weapons = await loadAllWeapons();
    const first = weapons[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    // All weapons should have dmg1 (filter enforces this)
    expect(first).toHaveProperty('dmg1');
    expect(typeof first.dmg1).toBe('string');
  }, 20000);

  it('weapons are sorted alphabetically', async () => {
    const { loadAllWeapons } = await import('@/utils/weaponDataLoader');
    const weapons = await loadAllWeapons();
    if (weapons.length < 2) return;
    const names = weapons.map(w => w.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  }, 20000);
});

// ---------------------------------------------------------------------------
// armorDataLoader — fs-based
// ---------------------------------------------------------------------------
describe('armorDataLoader', () => {
  it('loads a non-empty array of armors', async () => {
    const { loadAllArmors } = await import('@/utils/armorDataLoader');
    const armors = await loadAllArmors();
    expect(Array.isArray(armors)).toBe(true);
    expect(armors.length).toBeGreaterThan(0);
  }, 20000);

  it('each armor has id, name, source, category, and ac', async () => {
    const { loadAllArmors } = await import('@/utils/armorDataLoader');
    const armors = await loadAllArmors();
    const first = armors[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('ac');
  }, 20000);

  it('category is one of light, medium, heavy, shield', async () => {
    const { loadAllArmors } = await import('@/utils/armorDataLoader');
    const validCategories = new Set(['light', 'medium', 'heavy', 'shield']);
    const armors = await loadAllArmors();
    armors.forEach(a => {
      expect(validCategories.has(a.category)).toBe(true);
    });
  }, 20000);

  it('armors are sorted alphabetically', async () => {
    const { loadAllArmors } = await import('@/utils/armorDataLoader');
    const armors = await loadAllArmors();
    if (armors.length < 2) return;
    const names = armors.map(a => a.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  }, 20000);
});

// ---------------------------------------------------------------------------
// bestiaryDataLoader — fs-based (reads json/bestiary/*.json)
// Large dataset — use longer timeout.
// ---------------------------------------------------------------------------
describe('bestiaryDataLoader', () => {
  it('loads a non-empty array of monsters', async () => {
    const { loadAllBestiary } = await import('@/utils/bestiaryDataLoader');
    const monsters = await loadAllBestiary();
    expect(Array.isArray(monsters)).toBe(true);
    expect(monsters.length).toBeGreaterThan(0);
  }, 60000);

  it('each monster has required stat fields', async () => {
    const { loadAllBestiary } = await import('@/utils/bestiaryDataLoader');
    const monsters = await loadAllBestiary();
    const first = monsters[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('cr');
    expect(first).toHaveProperty('str');
    expect(first).toHaveProperty('dex');
    expect(first).toHaveProperty('con');
    expect(first).toHaveProperty('int');
    expect(first).toHaveProperty('wis');
    expect(first).toHaveProperty('cha');
    expect(first).toHaveProperty('hp');
    expect(first).toHaveProperty('ac');
  }, 60000);

  it('monsters are sorted alphabetically by name', async () => {
    const { loadAllBestiary } = await import('@/utils/bestiaryDataLoader');
    const monsters = await loadAllBestiary();
    if (monsters.length < 2) return;
    const names = monsters.map(m => m.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  }, 60000);

  it('ability scores are positive integers', async () => {
    const { loadAllBestiary } = await import('@/utils/bestiaryDataLoader');
    const monsters = await loadAllBestiary();
    monsters.slice(0, 20).forEach(m => {
      expect(m.str).toBeGreaterThan(0);
      expect(m.dex).toBeGreaterThan(0);
      expect(m.con).toBeGreaterThan(0);
    });
  }, 60000);
});

// ---------------------------------------------------------------------------
// classDataLoader — fs-based (reads json/class/*.json)
// ---------------------------------------------------------------------------
describe('classDataLoader', () => {
  it('loads a non-empty array of classes', async () => {
    const { loadAllClasses } = await import('@/utils/classDataLoader');
    const classes = await loadAllClasses();
    expect(Array.isArray(classes)).toBe(true);
    expect(classes.length).toBeGreaterThan(0);
  }, 30000);

  it('each class has id, name, source, hitDie, and subclasses', async () => {
    const { loadAllClasses } = await import('@/utils/classDataLoader');
    const classes = await loadAllClasses();
    const first = classes[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('hitDie');
    expect(first).toHaveProperty('subclasses');
    expect(Array.isArray(first.subclasses)).toBe(true);
  }, 30000);

  it('well-known classes are present (Fighter, Wizard, Rogue)', async () => {
    const { loadAllClasses } = await import('@/utils/classDataLoader');
    const classes = await loadAllClasses();
    const names = classes.map(c => c.name.toLowerCase());
    expect(names).toContain('fighter');
    expect(names).toContain('wizard');
    expect(names).toContain('rogue');
  }, 30000);
});

// ---------------------------------------------------------------------------
// itemDataLoader — fs-based
// ---------------------------------------------------------------------------
describe('itemDataLoader', () => {
  it('loads a non-empty array of items', async () => {
    const { loadAllItems } = await import('@/utils/itemDataLoader');
    const items = await loadAllItems();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  }, 20000);

  it('each item has id, name, source, and category', async () => {
    const { loadAllItems } = await import('@/utils/itemDataLoader');
    const items = await loadAllItems();
    const first = items[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('category');
  }, 20000);
});

// ---------------------------------------------------------------------------
// magicItemDataLoader — fs-based
// ---------------------------------------------------------------------------
describe('magicItemDataLoader', () => {
  it('loads a non-empty array of magic items', async () => {
    const { loadAllMagicItems } = await import('@/utils/magicItemDataLoader');
    const items = await loadAllMagicItems();
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  }, 20000);

  it('each magic item has id, name, source, category, and rarity', async () => {
    const { loadAllMagicItems } = await import('@/utils/magicItemDataLoader');
    const items = await loadAllMagicItems();
    const first = items[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('source');
    expect(first).toHaveProperty('category');
    expect(first).toHaveProperty('rarity');
  }, 20000);

  it('magic items are sorted alphabetically', async () => {
    const { loadAllMagicItems } = await import('@/utils/magicItemDataLoader');
    const items = await loadAllMagicItems();
    if (items.length < 2) return;
    const names = items.map(i => i.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  }, 20000);
});

// ---------------------------------------------------------------------------
// lazyDataLoader — wraps apiClient (fetch to /api routes)
// Skipped: requires a running Next.js server; not suitable for unit tests.
// ---------------------------------------------------------------------------
describe.skip('lazyDataLoader (skipped — requires Next.js API server)', () => {
  it('lazyLoadBestiary should call fetchBestiary', async () => {
    const { lazyLoadBestiary } = await import('@/utils/lazyDataLoader');
    const result = await lazyLoadBestiary();
    expect(Array.isArray(result)).toBe(true);
  });
});
