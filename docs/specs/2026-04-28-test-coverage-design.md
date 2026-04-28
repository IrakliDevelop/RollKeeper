# Test Coverage Plan — RollKeeper

## Goal

Add comprehensive test coverage across the entire RollKeeper codebase to enable safe, aggressive refactoring. The primary refactoring target is `characterStore.ts` (5,157 lines), but coverage should extend to all stores, utilities, hooks, API routes, and components.

## Current State

| Category | Tested | Total | Coverage |
|----------|--------|-------|----------|
| Zustand stores | 3 | 9 | 33% |
| Utility functions | 3 | 50 | 6% |
| Hooks | 2 | 31 | 6% |
| Components (stories) | 3 | 50+ | 6% |
| API routes | 6 | 33 | 18% |

Existing infrastructure is solid: Vitest with dual projects (unit + storybook), mock factories in `src/test/helpers.ts`, Redis and fetch mocks in `src/test/mocks/`.

## Strategy

Hybrid bottom-up: test the shared pure-function foundation first, then build upward through stores, hooks/API routes, component interactions, and visual regression. Each phase is a self-contained sprint that delivers independently valuable coverage.

## Phase 1: Pure Utility Functions

**Sprint estimate:** 1-2 weeks

Test the D&D math and data transformation layer. Pure functions, no React or Zustand dependencies. Highest value per line of test code.

### Targets

**Core calculation logic:**
- `src/utils/calculations.ts` (1,140 lines) — modifiers, proficiency bonus, spell slots, spell save DC, spell attack bonus, XP tables, level calculation, trait max uses, weapon/magic item charge calculations
- `src/utils/hpCalculations.ts` (235 lines) — applyDamage, applyHealing, addTemporaryHP, makeDeathSave, resetDeathSaves, calculateMaxHP, getClassHitDie, isDead
- `src/utils/multiclass.ts` (404 lines) — migrateToMulticlass, calculateHitDicePools, multiclass spell slot calculation

**Inventory math:**
- `src/utils/currency.ts` — currency conversion and total calculation
- `src/utils/encumbrance.ts` — carry capacity and encumbrance thresholds

**Dice utilities:**
- `src/utils/diceUtils.ts` — dice string parsing, roll simulation

**Data converters (raw JSON to internal types):**
- `src/utils/spellConversion.ts` (373 lines)
- `src/utils/weaponConversion.ts`
- `src/utils/armorConversion.ts`
- `src/utils/itemConversion.ts`
- `src/utils/magicItemConversion.ts`
- `src/utils/featureConversion.ts`
- `src/utils/encounterConverter.ts` — extend existing tests
- `src/utils/summonConverter.ts` (600 lines)

**Data loaders (parse raw JSON game data files):**
- `src/utils/spellDataLoader.ts` (1,598 lines)
- `src/utils/classDataLoader.ts` (929 lines)
- `src/utils/bestiaryDataLoader.ts`
- `src/utils/weaponDataLoader.ts`
- `src/utils/armorDataLoader.ts`
- `src/utils/itemDataLoader.ts`
- `src/utils/magicItemDataLoader.ts`
- `src/utils/featDataLoader.ts`
- `src/utils/raceDataLoader.ts`
- `src/utils/backgroundDataLoader.ts`
- `src/utils/sensesDataLoader.ts`
- `src/utils/conditionsDiseasesLoader.ts`

**Parsing utilities:**
- `src/utils/referenceParser.ts` (555 lines)
- `src/utils/additionalSpellsParser.ts` (476 lines)
- `src/utils/attachedSpellsParser.ts`
- `src/utils/additionalSpellsResolver.ts`
- `src/utils/parseEntriesToHtml.ts`

**Other utilities:**
- `src/utils/textFormatting.ts`
- `src/utils/sourceUtils.ts`
- `src/utils/calendarCalculations.ts` — extend existing tests
- `src/utils/cn.ts`

### Test approach

Standard Vitest unit tests. Each test file mirrors the source file path under `__tests__/`. Import the function, call it with known inputs, assert expected outputs. Use the existing `src/test/helpers.ts` mock factories for creating test data.

### Milestone

All D&D math and data transformation logic is verified. Any calculation function can be refactored with confidence.

---

## Phase 2: Zustand Store Logic

**Sprint estimate:** 2 weeks

Test the store orchestration layer. These tests verify that store actions correctly compose the Phase 1 utilities and manage state transitions.

### Targets

**characterStore.ts (5,157 lines) — grouped by domain:**
- Ability scores, skills, saving throws — updateAbilityScore, updateSkillProficiency, updateSkillExpertise, toggleSkillBonusAbility, updateSavingThrowProficiency
- HP management — applyDamageToCharacter, applyHealingToCharacter, addTemporaryHPToCharacter, makeDeathSavingThrow, resetDeathSavingThrows, toggleHPCalculationMode, recalculateMaxHP
- Class & level — updateClass, updateLevel, addClassLevel, removeClassLevel, updateClassLevel, isMulticlassed, getClassDisplayString
- Spell management — updateSpellSlot, updatePactMagicSlot, resetSpellSlots, resetPactMagicSlots, startConcentration, stopConcentration
- Spellbook — addSpellToSpellbook, removeSpellFromSpellbook, toggleSpellFavorite, prepareSpell, reorderSpells, addCustomSpell
- Weapons — addWeapon, updateWeapon, deleteWeapon, equipWeapon, reorderWeapons, charge management
- Magic items — addMagicItem, updateMagicItem, deleteMagicItem, attuneMagicItem, charge pool management
- Armor — addArmorItem, updateArmorItem, deleteArmorItem, equipArmorItem
- Inventory & currency — addInventoryItem, updateItemQuantity, updateCurrency, addCurrency, subtractCurrency
- Extended features & traits — CRUD, usage tracking, rest resets, reordering, favorites, migration
- Conditions/diseases — add, update, remove, clear, exhaustion variant
- Buffs — add, update, delete, toggle, clearAll
- Defenses & senses — damage immunities/resistances, condition immunities, senses CRUD
- Rest mechanics — takeShortRest, takeLongRest (verify all resets happen correctly)
- Summons — addSummon, removeSummon, damageSummon, healSummon, concentration dismissal
- Persistence — saveCharacter, loadCharacter, resetCharacter, exportCharacter, importCharacter
- Migration — migrateCharacterData, migrateWeaponDamage, loadCharacterState with old data formats
- Reaction, heroic inspiration, bardic inspiration, AC management, hit dice, initiative

**playerStore.ts (482 lines):**
- Character roster CRUD (add, update, delete, duplicate, archive)
- Settings management
- Campaign linking per character
- Avatar management

**calendarStore.ts (203 lines):**
- Calendar configuration CRUD
- Event management
- Time advancement

**battleMapStore.ts (206 lines):**
- Battle map CRUD
- Annotation state

**combatLogStore.ts (245 lines):**
- Log entry creation
- Log filtering/clearing

**locationStore.ts (171 lines):**
- Location CRUD
- Map state management

**Extend existing tests:**
- `encounterStore` — add coverage for uncovered actions
- `npcStore` — add coverage for uncovered actions
- `dmStore` — add coverage for uncovered actions

### Test approach

Each test file creates a fresh Zustand store (using `create` directly or resetting state between tests). Call store actions, assert resulting state. No React rendering — Zustand stores are plain functions. Use `createMockCharacterState()` and other factories from `src/test/helpers.ts`.

### Milestone

All state management logic is verified. characterStore can be safely split into smaller domain stores (spellStore, inventoryStore, combatStore, etc.).

---

## Phase 3: Hooks and API Routes

**Sprint estimate:** 1-2 weeks

Two independent workstreams that can be developed in parallel.

### Hooks

**Campaign sync hooks:**
- `useCampaignSync` — extend existing tests
- `usePlayerSync` — extend existing tests
- `usePartySync`
- `useDmCalendarSync`
- `useDmCounterSync`
- `useDmConditionOverrides`
- `useDmEffectsSync`
- `useSharedCampaignState`
- `useLocationSync`

**Data-fetching hooks:**
- `useSpellsData`, `useWeaponsDbData`, `useArmorDbData`, `useItemsData`, `useMagicItemsData`
- `useClassData`, `useFeatsData`, `useBackgroundsData`, `useSensesData`, `useToolsData`
- `useFeatureSourcesData`

**Utility hooks:**
- `useAutoSave`, `useDebounce`, `useDiceRoller`, `useSimpleDiceRoll`
- `useDragAndDrop`, `useEquipmentFilters`, `useInfiniteScroll`
- `useCalendar`, `useTimeAgo`, `useHydration`, `useTheme`

**Test approach:** `@testing-library/react`'s `renderHook`. Data-fetching hooks use the existing fetch mock from `src/test/mocks/fetch.ts`. Sync hooks use the existing Redis mock from `src/test/mocks/redis.ts`. Timer-dependent hooks (useAutoSave, useDebounce) use `vi.useFakeTimers()`.

### API Routes

**Data-serving routes (read-only):**
- `bestiary`, `spells`, `classes`, `feats`
- `armor-db`, `weapons-db`, `items`, `magic-items`
- `backgrounds`, `races`, `senses`, `tools`

**Campaign mutation routes:**
- `locations/*`, `party-hp/*`, `npc/*`
- Remaining campaign sub-routes not yet covered

**Asset routes:**
- `avatar/*`, `banner/*`, `assets/*`

**Test approach:** Use the existing `createNextRequest` helper from `src/test/helpers.ts`. Mock Redis for campaign routes, mock S3 (`@aws-sdk/client-s3`) for asset routes. Test both success and error paths (400, 404, 500).

### Milestone

Full backend and data layer coverage. The entire non-UI stack is tested.

---

## Phase 4: Component Interaction Tests

**Sprint estimate:** 2-3 weeks

Storybook stories with play functions for all major components. Each story renders the component with mock data; play functions simulate user interactions and assert results.

### Tier 1 — Character sheet components (highest refactoring risk)

- `SpellManagement` (1,461 lines) — add/remove spells, prepare, cast, slot tracking
- `QuickSpells` (853 lines) — quick-cast flow, slot consumption
- `EquippedWeapons` (770 lines) — equip, attack roll, damage, charges
- `ArmorDefenseManager` (661 lines) — equip armor, AC calculation, shield toggle
- HP Manager — damage, heal, temp HP, death saves flow
- Hit Dice — use, restore, short rest recovery
- Conditions tracker — add, stack, remove conditions
- Ability scores panel — modify scores, see modifier updates
- Skills panel — toggle proficiency, expertise
- Saving throws panel — toggle proficiency
- Inventory sub-tabs — CRUD for each category, currency management
- `TabbedCharacterSheet` + `BookmarkTabs` — tab navigation, state persistence

### Tier 2 — DM/Campaign components

- `NPCFormDialog` (1,953 lines) — create/edit NPC flow
- `NPCDetailDialog` (980 lines) — view stat block, spell tab, inventory
- `NPCSpellTab` (1,065 lines) — NPC spellcasting flow
- `NPCSection` (813 lines) — NPC list, grouping, drag-and-drop
- `PlayerDetailDialog` (927 lines) — player overview, conditions, counters
- Encounter tracker — initiative, turn order, damage/heal entities
- Calendar components — date navigation, event creation
- Location/battle map components — basic rendering and interaction

### Tier 3 — Reference compendiums

- `ClassDetailClient` (1,120 lines) — class detail view, features by level
- Bestiary list/detail — search, filter, stat block display
- Spellbook list/detail — search, filter, spell detail
- Feats list — search, filter

### Tier 4 — Design system completeness

- Extend existing: Button, Input, Select stories
- New stories: Textarea, Checkbox, Switch, RadioGroup, Autocomplete, Card, Badge, Dialog, Toast, Tooltip

### Test approach

Each `.stories.tsx` file exports multiple stories representing key states (empty, populated, error, edge cases). Play functions use `@storybook/test` utilities (`userEvent.click`, `expect`, `within`). Stories run in the Storybook vitest project (headless Chromium via Playwright).

### Milestone

Every major component has behavioral interaction coverage. Component internals can be refactored and large components can be split safely.

---

## Phase 5: Visual Regression Testing

**Sprint estimate:** 1 week

Screenshot-based visual regression using Playwright's built-in `toHaveScreenshot()` against Storybook stories.

### Setup

- Playwright test files that load Storybook stories and capture screenshots
- Baseline snapshots committed to the repo in `__screenshots__/` directories alongside test files
- Both light and dark theme variants for every component
- Three viewport breakpoints: mobile (375px), tablet (768px), desktop (1280px)
- New script: `npm run test:visual` for Playwright screenshot comparisons
- `--update-snapshots` flag to accept intentional visual changes

### Scope

- All design system primitives (Button, Input, Select, Dialog, Card, Badge, etc.)
- Character sheet tabs in representative states (empty character, fully populated, edge cases like 0 HP, max level)
- DM dashboard key views (campaign list, campaign detail, encounter tracker)
- Reference compendium pages (bestiary, spellbook, classes, feats)

### Milestone

Full visual safety net. Any CSS, layout, or theme regression is caught automatically. Combined with Phase 4 interaction tests, this provides complete UI coverage.

---

## Estimated Timeline

| Phase | Focus | Duration | Cumulative |
|-------|-------|----------|------------|
| 1 | Pure utility functions | 1-2 weeks | 1-2 weeks |
| 2 | Zustand stores | 2 weeks | 3-4 weeks |
| 3 | Hooks + API routes | 1-2 weeks | 4-6 weeks |
| 4 | Component interactions | 2-3 weeks | 6-9 weeks |
| 5 | Visual regression | 1 week | 7-10 weeks |

Each phase is independently valuable. You can pause between phases and still benefit from the coverage already in place.

## Conventions

- Test files live in `__tests__/` directories adjacent to source files
- Test file naming: `<source-file>.test.ts` or `<source-file>.test.tsx`
- Story file naming: `<component-name>.stories.tsx` adjacent to the component
- Use existing mock factories from `src/test/helpers.ts`, extend as needed
- Use existing Redis mock from `src/test/mocks/redis.ts` for campaign-related tests
- Use existing fetch mock from `src/test/mocks/fetch.ts` for API-dependent tests
- New mock modules go in `src/test/mocks/`
- Run unit tests: `npm run test`
- Run storybook tests: via Storybook vitest project
- Run visual tests: `npm run test:visual` (new, added in Phase 5)

## Post-Completion: Refactoring Targets

Once full coverage is in place, the primary refactoring targets are:

1. **Split characterStore.ts** (5,157 lines) into domain stores: spellStore, inventoryStore, combatStore, progressionStore, etc.
2. **Break up large components**: NPCFormDialog (1,953), SpellManagement (1,461), ClassDetailClient (1,120), NPCSpellTab (1,065), NPCDetailDialog (980), PlayerDetailDialog (927), QuickSpells (853), NPCSection (813), EquippedWeapons (770)
3. **Extract shared logic** from components into custom hooks
4. **Standardize patterns** across similar features (e.g., consistent CRUD patterns for different inventory types)
