# Phase 3: Hooks & API Route Tests — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive unit tests for custom hooks and API route handlers to catch data-fetching bugs, caching issues, and sync logic errors.

**Architecture:** Hooks are tested via `@testing-library/react` `renderHook` + `waitFor`. API routes are tested by importing the handler function directly and passing a mock `NextRequest`, then asserting on the `NextResponse`. Existing test infrastructure provides `mockFetchResponse`/`mockFetchSequence`/`resetFetch` for fetch mocking and `mockRedis`/`resetRedis`/`seedRedis` for Redis mocking.

**Tech Stack:** Vitest, jsdom, @testing-library/react, vi.useFakeTimers, existing fetch + Redis mocks

**Important context:**
- Existing hook tests: `useCampaignSync.test.ts` and `usePlayerSync.test.ts` in `src/hooks/__tests__/`
- Existing API route tests: `create.test.ts`, `campaign.test.ts`, `players.test.ts`, `join.test.ts`, `sync.test.ts`, `share.test.ts`
- Fetch mock: `src/test/mocks/fetch.ts` — `mockFetchResponse(status, body)`, `mockFetchSequence([...])`, `resetFetch()`
- Redis mock: `src/test/mocks/redis.ts` — `mockRedis` object with get/set/del/sadd/smembers/pipeline, `resetRedis()`, `seedRedis(key, value)`, `seedRedisSet(key, members)`
- Test helpers: `src/test/helpers.ts` — `createNextRequest(url, opts)`, `createMockPlayerData()`, `createMockEncounterEntity()`
- Data-fetching hooks share a common pattern: module-level cache, fetch from `/api/*`, return `{ data, loading, error }`. Some use `clearXCache()` exports.
- The Redis mock does NOT currently support `campaignSharedKey`, `campaignMessagesKey`, `campaignEffectsKey`, or `campaignTransfersKey`. Task 1 extends the mock.
- Session-level caches in hooks use module-level `let cachedX = null` variables. Tests must call `clearXCache()` or reset the module between tests.

---

## File Structure

**Test infrastructure updates:**
- Modify: `src/test/mocks/redis.ts` — Add missing key helpers for shared state

**Hook test files (new):**
- `src/hooks/__tests__/useDebounce.test.ts` — useDebounce, useDebouncedSearch
- `src/hooks/__tests__/useTimeAgo.test.ts` — useTimeAgo
- `src/hooks/__tests__/useEquipmentFilters.test.ts` — useEquipmentFilters
- `src/hooks/__tests__/useAutoSave.test.ts` — useAutoSave
- `src/hooks/__tests__/useTheme.test.ts` — useThemeInit, useTheme
- `src/hooks/__tests__/useHydration.test.ts` — useHydration
- `src/hooks/__tests__/useSpellsData.test.ts` — useSpellsData (representative of all data-fetching hooks)
- `src/hooks/__tests__/useDataHooks.test.ts` — batch test for all remaining data-fetching hooks
- `src/hooks/__tests__/useSharedCampaignState.test.ts` — useSharedCampaignState
- `src/hooks/__tests__/usePartySync.test.ts` — usePartySync

**API route test files (new):**
- `src/app/api/spells/__tests__/route.test.ts` — GET /api/spells
- `src/app/api/bestiary/__tests__/route.test.ts` — GET /api/bestiary
- `src/app/api/campaign/[code]/shared/__tests__/route.test.ts` — GET/POST/DELETE /api/campaign/[code]/shared
- `src/app/api/campaign/[code]/party-hp/__tests__/route.test.ts` — GET /api/campaign/[code]/party-hp

---

### Task 1: Extend Redis mock for shared state keys

**Files:**
- Modify: `src/test/mocks/redis.ts`

- [ ] **Step 1: Read current Redis mock and lib/redis.ts**

Read `src/test/mocks/redis.ts` and `src/lib/redis.ts` to understand all exported key functions.

- [ ] **Step 2: Add missing key helpers to the mock**

The mock already has `campaignKey`, `campaignPlayersKey`, `campaignPlayerKey`, `characterShareKey`. Add:

```typescript
campaignSharedKey: (code: string, feature: string) =>
  `campaign:${code}:shared:${feature}`,
campaignMessagesKey: (code: string, playerId: string) =>
  `campaign:${code}:messages:${playerId}`,
campaignEffectsKey: (code: string, playerId: string) =>
  `campaign:${code}:effects:${playerId}`,
campaignTransfersKey: (code: string, playerId: string) =>
  `campaign:${code}:transfers:${playerId}`,
```

Also add to `mockRedis`:
- `srem` — remove member from set (needed by shared route)
- `lpush` / `lrange` / `ltrim` — list operations (needed by messages/effects)

Read `src/lib/redis.ts` to verify exact key patterns before adding them.

- [ ] **Step 3: Run existing tests to verify no regressions**

Run: `npm run test -- --reporter=verbose src/app/api/campaign`

- [ ] **Step 4: Commit**

```bash
git add src/test/mocks/redis.ts
git commit -m "test: extend Redis mock with shared state key helpers"
```

---

### Task 2: useDebounce + useDebouncedSearch tests

**Files:**
- Create: `src/hooks/__tests__/useDebounce.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedSearch } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('does not update value before delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 300 } }
    );

    rerender({ value: 'world', delay: 300 });
    vi.advanceTimersByTime(100);
    expect(result.current).toBe('hello');
  });

  it('updates value after delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'hello', delay: 300 } }
    );

    rerender({ value: 'world', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('world');
  });

  it('resets timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'a', delay: 300 } }
    );

    rerender({ value: 'b', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'c', delay: 300 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a'); // still debouncing

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('c'); // final value
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'start' } }
    );

    rerender({ value: 'end' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('start');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('end');
  });
});

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial search term', () => {
    const { result } = renderHook(() => useDebouncedSearch('', 300));
    expect(result.current.debouncedSearchTerm).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('shows isSearching while debouncing', () => {
    const { result, rerender } = renderHook(
      ({ term }) => useDebouncedSearch(term, 300),
      { initialProps: { term: '' } }
    );

    rerender({ term: 'fire' });
    expect(result.current.isSearching).toBe(true);
  });

  it('sets isSearching to false after debounce completes', () => {
    const { result, rerender } = renderHook(
      ({ term }) => useDebouncedSearch(term, 300),
      { initialProps: { term: '' } }
    );

    rerender({ term: 'fire' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedSearchTerm).toBe('fire');
    expect(result.current.isSearching).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useDebounce.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useDebounce.test.ts
git commit -m "test: add useDebounce and useDebouncedSearch tests"
```

---

### Task 3: useTimeAgo tests

**Files:**
- Create: `src/hooks/__tests__/useTimeAgo.test.ts`

- [ ] **Step 1: Write the test file**

Read `src/hooks/useTimeAgo.ts` to verify exact output format. Test cases:

- Renders "just now" for timestamps within last minute
- Renders "X minutes ago" for recent timestamps
- Renders "X hours ago" for older timestamps
- Updates on timer interval (use fake timers)
- Handles null/undefined input gracefully

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useTimeAgo.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useTimeAgo.test.ts
git commit -m "test: add useTimeAgo tests"
```

---

### Task 4: useEquipmentFilters tests

**Files:**
- Create: `src/hooks/__tests__/useEquipmentFilters.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEquipmentFilters } from '@/hooks/useEquipmentFilters';

const items = [
  { name: 'Longsword', isEquipped: true, isAttuned: false, category: 'martial', rarity: 'common', chargePool: null, charges: null },
  { name: 'Shield +1', isEquipped: true, isAttuned: true, category: 'shield', rarity: 'uncommon', chargePool: null, charges: null },
  { name: 'Wand of Fireballs', isEquipped: false, isAttuned: true, category: 'wand', rarity: 'rare', chargePool: { maxCharges: 7 }, charges: null },
  { name: 'Dagger', isEquipped: false, isAttuned: false, category: 'simple', rarity: 'common', chargePool: null, charges: null },
];

describe('useEquipmentFilters', () => {
  it('returns all items by default', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    expect(result.current.filteredItems).toHaveLength(4);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('filters by search term (case-insensitive)', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('search', 'sword');
    });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe('Longsword');
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('filters equipped only', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('equipped', 'equipped');
    });
    expect(result.current.filteredItems).toHaveLength(2);
  });

  it('filters unequipped only', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('equipped', 'unequipped');
    });
    expect(result.current.filteredItems).toHaveLength(2);
  });

  it('filters attuned only', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('attuned', 'attuned');
    });
    expect(result.current.filteredItems).toHaveLength(2);
  });

  it('filters by category', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('category', 'martial');
    });
    expect(result.current.filteredItems).toHaveLength(1);
  });

  it('filters by rarity', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('rarity', 'rare');
    });
    expect(result.current.filteredItems).toHaveLength(1);
  });

  it('filters with charges', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('hasCharges', 'with');
    });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe('Wand of Fireballs');
  });

  it('filters without charges', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('hasCharges', 'without');
    });
    expect(result.current.filteredItems).toHaveLength(3);
  });

  it('combines multiple filters', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('equipped', 'equipped');
      result.current.updateFilter('rarity', 'common');
    });
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe('Longsword');
  });

  it('resets all filters', () => {
    const { result } = renderHook(() => useEquipmentFilters(items));
    act(() => {
      result.current.updateFilter('search', 'sword');
      result.current.resetFilters();
    });
    expect(result.current.filteredItems).toHaveLength(4);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('skips attuned filter when showAttuned is false', () => {
    const { result } = renderHook(() =>
      useEquipmentFilters(items, { showAttuned: false })
    );
    act(() => {
      result.current.updateFilter('attuned', 'attuned');
    });
    expect(result.current.filteredItems).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useEquipmentFilters.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useEquipmentFilters.test.ts
git commit -m "test: add useEquipmentFilters tests"
```

---

### Task 5: useAutoSave tests

**Files:**
- Create: `src/hooks/__tests__/useAutoSave.test.ts`

- [ ] **Step 1: Write the test file**

Test the following behaviors:
- Does not auto-save on initial mount
- Triggers debounced save when `hasUnsavedChanges` changes to true
- Calls `saveCharacter()` after delay
- `manualSave()` saves immediately without debounce
- Does not save when `enabled: false`
- Does not save when no unsaved changes
- Keyboard shortcut Ctrl+S triggers manual save
- Visibility change to hidden triggers immediate save
- Returns `{ saveStatus, hasUnsavedChanges, manualSave, isAutoSaveEnabled }`

Setup: Use `vi.useFakeTimers()`. Mock the Zustand stores by setting state directly before rendering the hook:
```typescript
import { useCharacterStore } from '@/store/characterStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

// Set up characterStore with unsaved changes
useCharacterStore.setState({
  character: makeCharacter(),
  hasUnsavedChanges: true,
  saveStatus: 'unsaved',
  ...
});
```

Read `src/hooks/useAutoSave.ts` to verify exact behavior before writing tests.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useAutoSave.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useAutoSave.test.ts
git commit -m "test: add useAutoSave tests"
```

---

### Task 6: useTheme tests

**Files:**
- Create: `src/hooks/__tests__/useTheme.test.ts`

- [ ] **Step 1: Write the test file**

Test `useThemeInit` (the real hook; `useTheme` is just a context consumer):
- Defaults to 'system' theme, 'light' resolved theme
- Reads stored theme from localStorage
- `setTheme('dark')` updates theme and resolvedTheme
- `setTheme('system')` resolves to system preference
- Persists choice to localStorage
- Applies `data-theme="dark"` attribute on document
- Removes `data-theme` for light mode

Read `src/hooks/useTheme.ts` — note the module-level `currentTheme`/`currentResolved` variables. These persist across tests, so reset them in `beforeEach`.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useTheme.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useTheme.test.ts
git commit -m "test: add useTheme tests"
```

---

### Task 7: useSpellsData tests (representative data-fetching hook)

**Files:**
- Create: `src/hooks/__tests__/useSpellsData.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSpellsData, clearSpellCache } from '@/hooks/useSpellsData';
import { mockFetchResponse, resetFetch } from '@/test/mocks/fetch';

describe('useSpellsData', () => {
  beforeEach(() => {
    resetFetch();
    clearSpellCache();
  });

  it('starts with loading=true', () => {
    mockFetchResponse(200, { spells: [] });
    const { result } = renderHook(() => useSpellsData());
    expect(result.current.loading).toBe(true);
  });

  it('loads spells and sets loading=false', async () => {
    const mockSpells = [
      { id: 'fireball', name: 'Fireball', level: 3, school: 'evocation' },
    ];
    mockFetchResponse(200, { spells: mockSpells });

    const { result } = renderHook(() => useSpellsData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.spells).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    mockFetchResponse(500, { error: 'Server error' });

    const { result } = renderHook(() => useSpellsData());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBeTruthy();
  });

  it('getSpellById finds a spell', async () => {
    mockFetchResponse(200, {
      spells: [{ id: 'fireball', name: 'Fireball', level: 3 }],
    });
    const { result } = renderHook(() => useSpellsData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getSpellById('fireball')?.name).toBe('Fireball');
  });

  it('getSpellByName finds case-insensitively', async () => {
    mockFetchResponse(200, {
      spells: [{ id: 'fireball', name: 'Fireball', level: 3 }],
    });
    const { result } = renderHook(() => useSpellsData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.getSpellByName('fireball')?.id).toBe('fireball');
  });

  it('uses cache on second render', async () => {
    const fetchFn = mockFetchResponse(200, {
      spells: [{ id: 's1', name: 'Shield', level: 1 }],
    });

    const { result: r1 } = renderHook(() => useSpellsData());
    await waitFor(() => expect(r1.current.loading).toBe(false));

    const { result: r2 } = renderHook(() => useSpellsData());
    await waitFor(() => expect(r2.current.loading).toBe(false));

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useSpellsData.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useSpellsData.test.ts
git commit -m "test: add useSpellsData tests"
```

---

### Task 8: Batch data-fetching hook tests

**Files:**
- Create: `src/hooks/__tests__/useDataHooks.test.ts`

- [ ] **Step 1: Write the test file**

All data-fetching hooks follow the same pattern: fetch from `/api/*`, return `{ loading, error, data }`. Write a batch test covering the remaining hooks. For each hook, test:
- starts with `loading: true`
- loads data and sets `loading: false`
- handles fetch error

Hooks to cover (read each file to verify exports and cache clear functions):
- `useBackgroundsData` — `/api/backgrounds`
- `useFeatsData` — `/api/feats`
- `useClassData` — `/api/classes`
- `useToolsData` — `/api/tools`
- `useArmorDbData` — `/api/armor-db`
- `useWeaponsDbData` — `/api/weapons-db`
- `useItemsData` — `/api/items`
- `useMagicItemsData` — `/api/magic-items`
- `useSensesData` — `/api/senses`

Each hook may have different response shapes. Read the hook file to check what property the response uses (e.g., `data.spells`, `data.backgrounds`, etc.).

Clear module-level caches between tests using each hook's `clearXCache()` export (if available), or use `vi.resetModules()`.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useDataHooks.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useDataHooks.test.ts
git commit -m "test: add batch data-fetching hook tests"
```

---

### Task 9: usePartySync tests

**Files:**
- Create: `src/hooks/__tests__/usePartySync.test.ts`

- [ ] **Step 1: Write the test file**

Read `src/hooks/usePartySync.ts` first. Test:
- Fetches party HP data from `/api/campaign/[code]/party-hp`
- Returns player HP array
- Polls on interval
- Pauses when document is hidden (idle detection)
- Handles fetch errors gracefully
- Does not poll when disabled

Follow the same pattern as existing `useCampaignSync.test.ts` — use `vi.useFakeTimers()`, `mockFetchResponse`, `renderHook`, `waitFor`.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/usePartySync.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/usePartySync.test.ts
git commit -m "test: add usePartySync tests"
```

---

### Task 10: useSharedCampaignState tests

**Files:**
- Create: `src/hooks/__tests__/useSharedCampaignState.test.ts`

- [ ] **Step 1: Write the test file**

Read `src/hooks/useSharedCampaignState.ts` first. This is the most complex hook — it polls `/api/campaign/[code]/shared` and manages messages, item transfers, DM effects, calendar, and counters.

Test:
- Fetches shared state on mount
- Returns calendar, messages, transfers, effects, counters
- Acknowledges messages (POST to acknowledge endpoint)
- Handles item transfers
- Polls on interval
- Pauses when idle/hidden
- Handles fetch errors

Use `vi.useFakeTimers()`, `mockFetchSequence` for multi-poll scenarios.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useSharedCampaignState.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useSharedCampaignState.test.ts
git commit -m "test: add useSharedCampaignState tests"
```

---

### Task 11: API route — GET /api/spells (representative data endpoint)

**Files:**
- Create: `src/app/api/spells/__tests__/route.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';

// Mock the data loader
vi.mock('@/utils/spellDataLoader', () => ({
  loadAllSpells: vi.fn().mockResolvedValue([
    { id: 'fireball', name: 'Fireball', level: 3, school: 'evocation' },
    { id: 'shield', name: 'Shield', level: 1, school: 'abjuration' },
    { id: 'magic-missile', name: 'Magic Missile', level: 1, school: 'evocation' },
  ]),
}));

describe('GET /api/spells', () => {
  it('returns all spells', async () => {
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

    expect(data.spells).toHaveLength(2);
    expect(data.total).toBe(3);
    expect(data.hasMore).toBe(true);
  });

  it('returns remaining spells with offset', async () => {
    const req = new NextRequest('http://localhost/api/spells?limit=2&offset=2');
    const res = await GET(req);
    const data = await res.json();

    expect(data.spells).toHaveLength(1);
    expect(data.hasMore).toBe(false);
  });

  it('returns 500 on loader error', async () => {
    const { loadAllSpells } = await import('@/utils/spellDataLoader');
    (loadAllSpells as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('File not found')
    );

    const req = new NextRequest('http://localhost/api/spells');
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/app/api/spells/__tests__/route.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/spells/__tests__/route.test.ts
git commit -m "test: add GET /api/spells tests"
```

---

### Task 12: API route — GET /api/bestiary (with search)

**Files:**
- Create: `src/app/api/bestiary/__tests__/route.test.ts`

- [ ] **Step 1: Write the test file**

Read `src/app/api/bestiary/route.ts` and `src/app/api/bestiary/search/route.ts` to understand the search/filter logic.

Test:
- Returns all monsters (paginated)
- Applies search filter
- Filters by CR range
- Filters by type
- Handles empty results
- Returns 500 on loader error

Mock the bestiary data loader similar to the spells test.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/app/api/bestiary/__tests__/route.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/bestiary/__tests__/route.test.ts
git commit -m "test: add GET /api/bestiary tests"
```

---

### Task 13: API route — /api/campaign/[code]/shared (complex Redis route)

**Files:**
- Create: `src/app/api/campaign/[code]/shared/__tests__/route.test.ts`

- [ ] **Step 1: Write the test file**

This is the most complex API route (357 lines). Read `src/app/api/campaign/[code]/shared/route.ts` first.

Test GET:
- Returns calendar, messages, effects, counters for a player
- Returns full calendar (with moons) for DM role
- Returns empty state for new campaign
- Handles missing playerId gracefully

Test POST:
- Sends a DM message (stores in messages key)
- Sends an item transfer
- Sends a DM effect
- Updates shared calendar
- Updates custom counter

Test DELETE:
- Acknowledges/clears messages for a player
- Clears item transfers

Use `seedRedis` to pre-populate campaign state, then call the route handler and assert on both the response and the Redis state.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/app/api/campaign/\\[code\\]/shared/__tests__/route.test.ts`

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/campaign/[code]/shared/__tests__/route.test.ts"
git commit -m "test: add /api/campaign/[code]/shared route tests"
```

---

### Task 14: API route — GET /api/campaign/[code]/party-hp

**Files:**
- Create: `src/app/api/campaign/[code]/party-hp/__tests__/route.test.ts`

- [ ] **Step 1: Write the test file**

Read `src/app/api/campaign/[code]/party-hp/route.ts` first. This route uses Redis pipeline to fetch all players' HP data.

Test:
- Returns HP array for all players in campaign
- Returns empty array when no players
- Handles missing player data gracefully
- Returns 500 on Redis error

Use `seedRedis` and `seedRedisSet` to set up campaign with players.

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/app/api/campaign/\\[code\\]/party-hp/__tests__/route.test.ts`

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/campaign/[code]/party-hp/__tests__/route.test.ts"
git commit -m "test: add GET /api/campaign/[code]/party-hp tests"
```

---

### Task 15: useHydration tests

**Files:**
- Create: `src/hooks/__tests__/useHydration.test.ts`

- [ ] **Step 1: Write the test file**

Read `src/hooks/useHydration.ts`. This is a small hook (26 lines) that waits for Zustand store hydration.

Test:
- Returns false initially (before hydration)
- Returns true after hydration completes
- Works with the persist middleware onFinishHydration callback

- [ ] **Step 2: Run the tests**

Run: `npm run test -- --reporter=verbose src/hooks/__tests__/useHydration.test.ts`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/__tests__/useHydration.test.ts
git commit -m "test: add useHydration tests"
```

---

### Task 16: Full suite verification

- [ ] **Step 1: Run all unit tests**

Run: `npm run test -- --reporter=verbose`

Expected: All tests pass.

- [ ] **Step 2: Run type checking**

Run: `npm run type-check`

Expected: No new type errors in test files.

- [ ] **Step 3: Fix any issues and commit**

If any test needed fixing:

```bash
git add -u
git commit -m "test: fix any issues found during Phase 3 verification"
```

- [ ] **Step 4: Verify test count**

Run: `npm run test -- --reporter=verbose 2>&1 | tail -5`

Expected: Test count increased from ~1,846 to ~2,000+ total.
