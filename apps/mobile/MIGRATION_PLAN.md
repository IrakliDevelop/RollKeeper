# RollKeeper: Web → Mobile Migration Plan

> Migrating the **player-facing features** from `apps/web` (Next.js) to `apps/mobile` (Expo / React Native).  
> The DM section, campaign management (DM-side), and encounter builder are **out of scope**.

---

## Table of Contents

1. [Goals & Principles](#1-goals--principles)
2. [Architecture Comparison](#2-architecture-comparison)
3. [Scope — What We're Migrating](#3-scope--what-were-migrating)
4. [Scope — What We're NOT Migrating](#4-scope--what-were-not-migrating)
5. [Phase Plan](#5-phase-plan)
6. [Phase 0 — Foundation](#6-phase-0--foundation)
7. [Phase 1 — Character Management](#7-phase-1--character-management)
8. [Phase 2 — Character Sheet (Core)](#8-phase-2--character-sheet-core)
9. [Phase 3 — Character Sheet (Extended)](#9-phase-3--character-sheet-extended)
10. [Phase 4 — Spellcasting & Spellbook](#10-phase-4--spellcasting--spellbook)
11. [Phase 5 — Reference Tools](#11-phase-5--reference-tools)
12. [Phase 6 — Dice Roller](#12-phase-6--dice-roller)
13. [Phase 7 — Campaign Sync (Player-side)](#13-phase-7--campaign-sync-player-side)
14. [Phase 8 — Polish & Platform Features](#14-phase-8--polish--platform-features)
15. [Component Mapping](#15-component-mapping)
16. [State Management Strategy](#16-state-management-strategy)
17. [Data & API Layer Strategy](#17-data--api-layer-strategy)
18. [Navigation Architecture](#18-navigation-architecture)
19. [Design System Translation](#19-design-system-translation)
20. [Shared Code Strategy](#20-shared-code-strategy)
21. [Testing Strategy](#21-testing-strategy)
22. [Open Questions](#22-open-questions)

---

## 1. Goals & Principles

**Primary goal:** Give players a native mobile companion that covers the same character management, character sheet, dice rolling, and reference features they already use on the web — optimized for a phone/tablet experience.

**Principles:**

- **Feature parity for players, not pixel parity.** The mobile app should cover the same *capabilities* but UX should be rethought for small screens and touch interactions.
- **Share logic, not UI.** Types, calculations, validation, and game data are shared. React components are rewritten in React Native — don't try to create cross-platform component abstractions.
- **Incremental delivery.** Each phase produces a usable app. Ship early, iterate.
- **Offline-first.** Mobile characters should work without connectivity, syncing when online. The web app already stores data in localStorage; mobile will use AsyncStorage / MMKV with the same pattern.
- **Same backend.** Mobile talks to the same `apps/api` Express server and Supabase auth. No separate backend.

---

## 2. Architecture Comparison

| Concern | Web (`apps/web`) | Mobile (`apps/mobile`) |
|---|---|---|
| Framework | Next.js 15 (App Router) | Expo SDK 55 (Expo Router) |
| Routing | File-based (`src/app/`) | File-based (`app/`) |
| Rendering | Server Components + Client | Client-only (all screens) |
| Styling | Tailwind CSS + design tokens | StyleSheet + design tokens |
| State | Zustand (persisted to localStorage) | Zustand (persisted to AsyncStorage/MMKV) |
| Auth | Supabase JS client | Supabase JS client (same) |
| API calls | `fetch` with Bearer token | `fetch` with Bearer token (same) |
| Real-time | Socket.io client | Socket.io client (same lib works in RN) |
| Rich text | Tiptap (DOM-based) | Markdown or simplified editor |
| 3D Dice | `@3d-dice/dice-box` (WebGL) | Custom RN animation or 2D dice |
| Game data | JSON files loaded server-side | Bundled JSON via `@rollkeeper/game-data` |

**Key difference:** Next.js server components load game data on the server and pass it to clients. In React Native everything is client-side, so game data should be bundled (imported from `@rollkeeper/game-data`) or fetched from the API.

---

## 3. Scope — What We're Migrating

### Player Dashboard
- Character list (active + archived)
- Create new character
- Import / export character (JSON)
- Archive / restore / delete / duplicate character

### Character Sheet (full)
- Ability scores (display, manual edit, roll)
- Skills (proficiency, expertise, roll)
- Saving throws (proficiency, roll)
- Hit points (current/max/temp, damage, heal, death saves)
- Armor class (base, modifiers, shield, temporary)
- Combat stats (initiative, speed, reaction)
- Hit dice (tracking, short rest usage)
- Spell slots (tracking, pact magic)
- Spellcasting stats (ability, DC, attack bonus)
- Spell list (known/prepared, cast spell, concentration)
- Equipment (weapons, armor, magic items)
- Inventory (items, currency)
- Features & traits (class, race, extended features with uses)
- Heroic inspiration, bardic inspiration
- Conditions & diseases
- Notes (session notes, background)
- XP tracker
- Rest management (short/long rest)
- Multiclass support
- Languages & proficiencies
- Character avatar
- Basic info (name, race, class, level, alignment, background)

### Reference Tools
- Spellbook browser (search, filter, detail view)
- Class compendium (browse, detail view)
- Bestiary (browse, filter, detail view)

### Dice Roller
- Standard dice rolling (d4–d100)
- Roll history

### Auth
- Sign in / sign up via Supabase
- Session persistence

### Campaign Sync (player-side only)
- Join campaign via invite code
- Sync character snapshot to campaign
- Leave campaign

---

## 4. Scope — What We're NOT Migrating

- **DM Dashboard** — campaign creation, member management, character monitoring
- **Encounter Builder / Combat Tracker** (DM tool)
- **Campaign management** (DM-side: create, edit, delete campaigns)
- **Real-time DM view** (Socket.io listeners for DM)
- **Landing page / marketing** (the `/` route)
- **Storybook / design system docs**
- **Next.js API routes** — mobile hits `apps/api` directly
- **3D dice** — will be replaced with native animation or 2D equivalent

---

## 5. Phase Plan

| Phase | Name | Description | Depends On |
|---|---|---|---|
| 0 | Foundation | Shared code, auth, storage, navigation shell | — |
| 1 | Character Management | Dashboard, create, import/export, archive | Phase 0 |
| 2 | Character Sheet (Core) | Ability scores, skills, saves, HP, AC, combat | Phase 1 |
| 3 | Character Sheet (Extended) | Equipment, inventory, features, notes, conditions | Phase 2 |
| 4 | Spellcasting & Spellbook | Spell slots, spell list, spellbook browser | Phase 2 |
| 5 | Reference Tools | Class compendium, bestiary browser | Phase 0 |
| 6 | Dice Roller | Enhanced dice rolling with notation parsing | Phase 0 |
| 7 | Campaign Sync | Join campaign, sync character, leave | Phase 2 |
| 8 | Polish & Platform | Haptics, notifications, widgets, offline | All |

**Estimated effort per phase:** 1–2 weeks each for a single developer.

---

## 6. Phase 0 — Foundation

Set up the infrastructure everything else depends on.

### Tasks

- [ ] **Auth integration** — Port `useAuth` hook to work with Supabase on React Native.  
  - Install `@supabase/supabase-js` (same package, works in RN).
  - Use `expo-secure-store` for session token persistence instead of browser cookies.
  - Create `AuthProvider` context wrapping the app.
  - Build sign-in / sign-up screens.

- [ ] **API client** — Port `src/lib/api.ts` (`apiFetch`, `campaignApi`, `characterApi`, `profileApi`).  
  - Same `fetch`-based client; React Native supports `fetch` natively.
  - Wire up Bearer token from Supabase session.
  - Environment variable: `EXPO_PUBLIC_API_URL`.

- [ ] **Persistent storage** — Replace localStorage with `react-native-mmkv` (or AsyncStorage).  
  - Create a Zustand `persist` middleware adapter for MMKV.
  - Same serialization format as web so exported characters are cross-compatible.

- [ ] **Navigation shell** — Already scaffolded with Expo Router tabs.  
  - Finalize tab structure: Characters, Spellbook, Dice, Profile.
  - Add stack navigators for character sheet, spell detail, etc.

- [ ] **Design tokens** — Port the color palette and spacing constants.  
  - `constants/Colors.ts` (done in starter setup).
  - Add `constants/Spacing.ts`, `constants/Typography.ts`.

- [ ] **Shared utilities** — Move pure calculation functions to a shared package or copy them.  
  See [Shared Code Strategy](#20-shared-code-strategy) for details.

### Web files to port

| Web source | Mobile target | Notes |
|---|---|---|
| `src/hooks/useAuth.ts` | `hooks/useAuth.ts` | Swap Supabase storage adapter |
| `src/lib/supabase.ts` | `lib/supabase.ts` | Use `expo-secure-store` |
| `src/lib/api.ts` | `lib/api.ts` | Mostly copy-paste |
| `src/contexts/AuthContext.tsx` | `contexts/AuthContext.tsx` | Same pattern |
| `src/utils/calculations.ts` | Shared package or `utils/` | Pure functions, no DOM |
| `src/utils/diceUtils.ts` | Shared package or `utils/` | Pure functions |
| `src/utils/hpCalculations.ts` | Shared package or `utils/` | Pure functions |
| `src/utils/multiclass.ts` | Shared package or `utils/` | Pure functions |
| `src/utils/constants.ts` | Shared package or `utils/` | Pure constants |

---

## 7. Phase 1 — Character Management

The player dashboard — listing, creating, and managing characters.

### Tasks

- [ ] **Player store** — Port `src/store/playerStore.ts` to mobile.  
  - Same Zustand store structure.
  - Swap `persist` middleware to use MMKV instead of localStorage.
  - All methods carry over: `createCharacter`, `deleteCharacter`, `archiveCharacter`, `restoreCharacter`, `duplicateCharacter`, `importCharacter`, `exportCharacter`.

- [ ] **Character list screen** — Replace placeholder with real data from playerStore.  
  - Active characters tab and archived characters tab.
  - Swipe-to-archive or long-press context menu.
  - Pull-to-refresh pattern.

- [ ] **Character creation** — New character flow.  
  - Can be a multi-step bottom sheet or separate screens.
  - Minimum: name, race, class, level.
  - Port `SimpleClassSelector` for class selection.

- [ ] **Import / export** — Character JSON import/export.  
  - Export: Share sheet (`expo-sharing`) with JSON file.
  - Import: File picker (`expo-document-picker`) to load JSON.
  - Port `src/utils/fileOperations.ts`.

### Web files to port

| Web source | Mobile target | Notes |
|---|---|---|
| `src/store/playerStore.ts` | `store/playerStore.ts` | Swap storage adapter |
| `src/app/player/page.tsx` | `app/(tabs)/index.tsx` | Rewrite UI in RN |
| `src/app/player/characters/new/page.tsx` | `app/character/new.tsx` | Simplified wizard |
| `src/utils/fileOperations.ts` | `utils/fileOperations.ts` | Swap File API for expo modules |

---

## 8. Phase 2 — Character Sheet (Core)

The core character sheet sections that players interact with every session.

### Tasks

- [ ] **Character store** — Port `src/store/characterStore.ts`.  
  - This is the largest store (~100 methods). Port in sections matching the UI phases.
  - Phase 2 methods: ability scores, skills, saving throws, HP, AC, combat stats, hit dice, death saves, rest management, basic info, XP.

- [ ] **Auto-save** — Port `useAutoSave` hook.  
  - Debounced persistence to MMKV.
  - Save status indicator in header.

- [ ] **Character sheet screen** — Tab/section-based layout.  
  - Use a scrollable tab view or collapsible sections (not bottom tabs — those are app-level).
  - Sections: Stats, Combat, Skills, Saves.
  - See [Navigation Architecture](#18-navigation-architecture) for layout options.

- [ ] **Ability scores section** — Display 6 scores with modifiers, tap to roll.
- [ ] **Skills section** — 18 skills with proficiency/expertise toggles, tap to roll.
- [ ] **Saving throws** — 6 saves with proficiency, tap to roll.
- [ ] **Hit points** — Current/max/temp HP, damage/heal controls, death saves.
- [ ] **Armor class** — Base AC, modifiers, shield toggle, temp AC.
- [ ] **Combat stats** — Initiative, speed, reaction used.
- [ ] **Hit dice** — Display and use hit dice, per-class pools for multiclass.
- [ ] **Rest management** — Short rest (spend hit dice, recover resources) and long rest (full recovery) flows. Could be action sheets.
- [ ] **Basic info header** — Name, race, class, level, avatar, alignment.
- [ ] **XP tracker** — Current XP, next level threshold, milestone toggle.

### Web components to port

| Web component | Mobile equivalent | Complexity |
|---|---|---|
| `AbilityScores.tsx` | `components/character/AbilityScores.tsx` | Medium |
| `Skills.tsx` | `components/character/Skills.tsx` | Medium |
| `SavingThrows.tsx` | `components/character/SavingThrows.tsx` | Low |
| `HitPointManager.tsx` | `components/character/HitPoints.tsx` | High |
| `ArmorClassManager.tsx` | `components/character/ArmorClass.tsx` | Medium |
| `CombatStats.tsx` | `components/character/CombatStats.tsx` | Low |
| `HitDiceManager.tsx` + `HitDiceTracker.tsx` | `components/character/HitDice.tsx` | Medium |
| `RestManager.tsx` | `components/character/RestManager.tsx` | Medium |
| `CharacterBasicInfo.tsx` | `components/character/BasicInfo.tsx` | Low |
| `CharacterHeaderSection.tsx` + `CharacterSheetHeader.tsx` | `components/character/SheetHeader.tsx` | Medium |
| `XPTracker.tsx` | `components/character/XPTracker.tsx` | Low |
| `QuickStats.tsx` | `components/character/QuickStats.tsx` | Low |
| `DeathSaves` (inside HitPointManager) | `components/character/DeathSaves.tsx` | Low |

### Key calculation utils to share

| Utility | What it does |
|---|---|
| `calculations.ts → getModifier(score)` | Ability score → modifier |
| `calculations.ts → getProficiencyBonus(level)` | Level → proficiency bonus |
| `calculations.ts → calculatePassivePerception(...)` | Passive perception from WIS + proficiency |
| `hpCalculations.ts → calculateMaxHP(...)` | Max HP from class, level, CON |
| `multiclass.ts → calculateMulticlassSpellSlots(...)` | Multiclass spell slot table |
| `diceUtils.ts → rollDice(notation)` | Parse and roll dice notation |

---

## 9. Phase 3 — Character Sheet (Extended)

Features players use frequently but not every turn.

### Tasks

- [ ] **Equipment section** — Weapons (with attack/damage rolls), armor, magic items (with charges).
- [ ] **Inventory** — General items list, currency (CP/SP/EP/GP/PP).
- [ ] **Features & traits** — Class features, racial traits, background features. Rich text display.
- [ ] **Extended features** — Trackable abilities with limited uses (e.g., Channel Divinity 2/2).
- [ ] **Heroic inspiration** — Toggle tracker.
- [ ] **Bardic inspiration** — Dice-based inspiration tracker (Bard-specific).
- [ ] **Conditions & diseases** — Active conditions with descriptions, remove on rest.
- [ ] **Notes** — Session notes (ordered list, add/remove/reorder). Rich text → simplified markdown or plain text on mobile.
- [ ] **Character background** — Story, personality traits, ideals, bonds, flaws.
- [ ] **Languages & proficiencies** — Language list, tool proficiencies with proficiency level.
- [ ] **Multiclass management** — Add/remove class levels, recalculate features.
- [ ] **Avatar** — Upload character avatar (`expo-image-picker`), display with fallback.

### Web components to port

| Web component | Mobile equivalent | Complexity |
|---|---|---|
| `EquipmentSection.tsx` + `equipment/` | `components/character/Equipment.tsx` | High |
| `InventoryManager.tsx` + `inventory/` | `components/character/Inventory.tsx` | High |
| `CurrencyManager.tsx` | `components/character/Currency.tsx` | Low |
| `FeaturesTraitsManager.tsx` | `components/character/Features.tsx` | Medium |
| `ExtendedFeatures/` (6 files) | `components/character/ExtendedFeatures.tsx` | High |
| `HeroicInspirationTracker.tsx` | `components/character/HeroicInspiration.tsx` | Low |
| `BardicInspirationTracker.tsx` | `components/character/BardicInspiration.tsx` | Low |
| `ConditionsDiseasesManager.tsx` | `components/character/Conditions.tsx` | Medium |
| `NotesManager.tsx` + `NoteModal.tsx` | `components/character/Notes.tsx` | Medium |
| `CharacterBackgroundEditor.tsx` | `components/character/Background.tsx` | Medium |
| `LanguagesAndProficiencies.tsx` | `components/character/Languages.tsx` | Low |
| `MulticlassManager.tsx` | `components/character/Multiclass.tsx` | Medium |
| `AvatarUpload.tsx` | `components/character/Avatar.tsx` | Medium |

### Platform considerations

- **Rich text:** The web uses Tiptap (DOM-based). On mobile, replace with a simple markdown renderer (`react-native-markdown-display`) or plain text with basic formatting. Don't try to port the full rich text editor initially.
- **Drag-and-drop:** Web notes use `useDragAndDrop` for reordering. Use `react-native-reanimated` + gesture handler for mobile reorder.
- **Modals:** Web uses `Dialog` component. Mobile equivalent: bottom sheets (`@gorhom/bottom-sheet`) or standard RN modals.

---

## 10. Phase 4 — Spellcasting & Spellbook

Spell management is one of the most complex and most-used player features.

### Tasks

- [ ] **Spell slot tracker** — Slot usage by level, pact magic slots.
- [ ] **Spell list management** — Known/prepared spells, add from spellbook, remove.
- [ ] **Spell detail view** — Full spell card with all properties.
- [ ] **Cast spell flow** — Select slot level, deduct slot, track concentration.
- [ ] **Concentration tracker** — Single active concentration spell with dismiss.
- [ ] **Spellcasting stats** — Spellcasting ability, save DC, attack bonus (auto-calculated).
- [ ] **Spellbook reference** — Browse all 540+ spells with search and filters.
  - Filtering: level, school, class, components, concentration, ritual.
  - Sort by name or level.
  - Infinite scroll / virtualized list.
  - Tap for detail view.
- [ ] **Personal spellbook** — Save spells, mark favorites, mark prepared.
- [ ] **Add spell to character** — Flow from spellbook → add to character's known spells.

### Web components to port

| Web component | Mobile equivalent | Complexity |
|---|---|---|
| `SpellSlotTracker.tsx` | `components/character/SpellSlots.tsx` | Medium |
| `SpellcastingStats.tsx` | `components/character/SpellcastingStats.tsx` | Low |
| `EnhancedSpellManagement.tsx` | `components/character/SpellList.tsx` | High |
| `SpellCastModal.tsx` | `components/character/CastSpell.tsx` | Medium |
| `ConcentrationTracker.tsx` | `components/character/Concentration.tsx` | Low |
| `SpellDetailsModal.tsx` | `components/spellbook/SpellDetail.tsx` | Medium |
| `spellbook/SpellbookClient.tsx` | `app/(tabs)/spellbook.tsx` (enhance) | High |
| `spellbook/SpellCard.tsx` | `components/spellbook/SpellCard.tsx` | Medium |
| `spellbook/SpellFiltersPanel.tsx` | `components/spellbook/SpellFilters.tsx` | Medium |
| `spellbook/PersonalSpellbook.tsx` | `components/spellbook/PersonalSpellbook.tsx` | Medium |

### Performance notes

- 540+ spells is a large dataset for mobile. Use `FlashList` (from Shopify) instead of `FlatList` for virtualized rendering.
- Load spell data from `@rollkeeper/game-data` package (bundled JSON). Process at app startup and cache in memory.
- Port `src/utils/spellConversion.ts` for data normalization.

---

## 11. Phase 5 — Reference Tools

Read-only reference browsers for game content.

### Tasks

- [ ] **Class compendium** — Browse classes, view details (features, subclasses, progression tables).
- [ ] **Bestiary** — Browse monsters, filter by CR/type/size, view stat blocks.
- [ ] **Feats browser** — Browse feats (if implemented on web by then).

### Web components to port

| Web component | Mobile equivalent | Complexity |
|---|---|---|
| `classes/ClassCompendiumClient.tsx` | `app/classes/index.tsx` | High |
| `classes/ClassCard.tsx` | `components/classes/ClassCard.tsx` | Medium |
| `classes/ClassDetailClient.tsx` | `app/classes/[classId].tsx` | High |
| `bestiary/BestiaryCompendiumClient.tsx` | `app/bestiary/index.tsx` | High |
| `bestiary/MonsterCard.tsx` | `components/bestiary/MonsterCard.tsx` | Medium |
| `bestiary/MonsterModal.tsx` | `app/bestiary/[monsterId].tsx` | High |

### Data loading

- Classes: 15 JSON files, ~150KB total → bundle from `@rollkeeper/game-data`.
- Bestiary: 100 JSON files, large dataset → lazy-load, search via API endpoint or load selectively.
- Port `classDataLoader.ts`, `bestiaryDataLoader.ts` from web `src/utils/`.

---

## 12. Phase 6 — Dice Roller

Enhance the basic dice roller already in the mobile app.

### Tasks

- [ ] **Dice notation parsing** — Support standard notation: `2d6+3`, `1d20+5`, `4d6kh3` (keep highest).
- [ ] **Roll modifiers** — Auto-apply ability modifiers for skill/save/attack rolls.
- [ ] **Roll history** — Persistent history with timestamp, notation, result breakdown.
- [ ] **Advantage / disadvantage** — Roll 2d20 and pick high/low.
- [ ] **Animated results** — Use `react-native-reanimated` for a satisfying roll animation.
- [ ] **Haptic feedback** — Vibrate on roll (`expo-haptics`).
- [ ] **Quick roll** — Tap ability score / skill / weapon attack to roll directly from character sheet.

### Web files to port

| Web source | Mobile target | Notes |
|---|---|---|
| `src/utils/diceUtils.ts` | `utils/diceUtils.ts` | Pure functions, direct copy |
| `src/hooks/useDiceRoller.ts` | `hooks/useDiceRoller.ts` | Remove DiceBox/WebGL, keep logic |
| `src/hooks/useSimpleDiceRoll.ts` | `hooks/useSimpleDiceRoll.ts` | Mostly copy-paste |
| `ui/game/DiceButton.tsx` | `components/dice/DiceButton.tsx` | Rewrite for RN |
| `ui/game/DiceResultDisplay.tsx` | `components/dice/DiceResult.tsx` | Rewrite for RN |

### What NOT to port
- `@3d-dice/dice-box` and `@3d-dice/dice-ui` — these are WebGL-based and don't work in React Native. Replace with 2D animated dice or simple number animations.

---

## 13. Phase 7 — Campaign Sync (Player-side)

Allow players to join DM campaigns and sync their characters.

### Tasks

- [ ] **Join campaign** — Enter invite code, call `campaignApi.join(code)`.
- [ ] **Campaign list** — Show campaigns the player has joined.
- [ ] **Sync character** — Push character snapshot to campaign via `characterApi.sync(...)`.
- [ ] **Leave campaign** — Call `campaignApi.leave(id)`.
- [ ] **Socket.io real-time** — Optional: live sync indicator showing when connected.

### Web files to port

| Web source | Mobile target | Notes |
|---|---|---|
| `src/store/campaignStore.ts` | `store/campaignStore.ts` | Subset (player methods only) |
| `src/hooks/useCampaignSync.ts` | `hooks/useCampaignSync.ts` | Same Socket.io client works in RN |
| `src/lib/api.ts` (campaignApi, characterApi) | `lib/api.ts` | Already ported in Phase 0 |

---

## 14. Phase 8 — Polish & Platform Features

Native mobile features that don't exist on web.

### Tasks

- [ ] **Haptic feedback** — Dice rolls, button presses, save confirmations.
- [ ] **Push notifications** — Campaign invites, DM messages (future).
- [ ] **Offline mode** — Full offline character editing with sync queue.
- [ ] **App icon & splash screen** — RollKeeper branded assets.
- [ ] **Widgets** (stretch) — iOS/Android home screen widget showing character HP/spell slots.
- [ ] **Quick actions** — 3D Touch / long-press app icon actions (open character, roll dice).
- [ ] **Dark/light theme** — Already foundation is in place, ensure all screens respect it.
- [ ] **Accessibility** — VoiceOver/TalkBack labels, dynamic type support.
- [ ] **Performance audit** — Profile with Flipper, optimize list rendering, reduce bundle size.
- [ ] **EAS Build setup** — Configure `eas.json` for development, preview, production builds.

---

## 15. Component Mapping

### Pattern: How to translate a web component

```
Web (Tailwind + HTML)                    Mobile (StyleSheet + RN)
─────────────────────                    ────────────────────────
<div className="flex ...">        →      <View style={styles.row}>
<p className="text-sm ...">       →      <Text style={styles.label}>
<button onClick={...}>            →      <Pressable onPress={...}>
<input value={...}>               →      <TextInput value={...}>
className="bg-slate-800"          →      { backgroundColor: Colors[colorScheme].surface }
Tailwind responsive (sm:, md:)    →      useWindowDimensions() + conditional styles
Dialog / Modal                    →      Bottom sheet or RN Modal
Framer Motion animations          →      react-native-reanimated
```

### Reusable mobile component library to build

These replace the web design system (`@/components/ui/`) in mobile context:

| Component | Purpose |
|---|---|
| `StatBox` | Ability score / stat display with modifier |
| `SkillRow` | Skill row with proficiency indicator and roll button |
| `ResourceTracker` | Generic current/max tracker (HP, spell slots, hit dice) |
| `ToggleChip` | Proficiency / expertise / prepared toggle |
| `SectionCard` | Card container for sheet sections |
| `ActionSheet` | Bottom action sheet for context menus |
| `RollButton` | Tap-to-roll button with die icon |
| `SearchBar` | Reusable search input with filter icon |
| `FilterSheet` | Bottom sheet with filter options |
| `ListItem` | Standard list row for spells, items, etc. |
| `EmptyState` | Empty state illustration + message |
| `Badge` | Status badge (level, school, rarity) |

---

## 16. State Management Strategy

### Store architecture (same as web)

```
playerStore (Zustand + MMKV persist)
├── characters[]           — all characters
├── activeCharacterId      — selected character
├── settings               — player preferences
└── methods: CRUD, import/export, archive

characterStore (Zustand + MMKV persist)
├── character              — active character full state
├── saveStatus             — saved/saving/error
├── hasUnsavedChanges
└── methods: 100+ character mutations

campaignStore (Zustand, not persisted — fetched from API)
├── campaigns[]            — joined campaigns
├── loading, error
└── methods: join, leave, sync
```

### Persistence adapter

The web uses Zustand's `persist` middleware with `localStorage`. Mobile needs a different storage backend:

```typescript
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

// Use in Zustand persist:
persist(storeCreator, { name: 'rollkeeper-player-data', storage: mmkvStorage })
```

### What to copy directly

The store files (`playerStore.ts`, `characterStore.ts`) contain pure state logic with no DOM dependencies. They can be copied almost verbatim — only the `persist` storage adapter changes.

---

## 17. Data & API Layer Strategy

### API client

The web's `apiFetch` function uses `fetch()` which works identically in React Native. The API client (`src/lib/api.ts`) can be copied with minimal changes:

- Change `process.env.NEXT_PUBLIC_API_URL` → `process.env.EXPO_PUBLIC_API_URL`.
- Same `campaignApi`, `characterApi`, `profileApi` objects.

### Supabase auth

`@supabase/supabase-js` works in React Native. The only change is the auth storage adapter:

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: SecureStore.getItemAsync,
      setItem: SecureStore.setItemAsync,
      removeItem: SecureStore.deleteItemAsync,
    },
    autoRefreshToken: true,
    persistSession: true,
  },
});
```

### Game data loading

| Data | Size | Strategy |
|---|---|---|
| Spells (540+) | ~2MB JSON | Bundle via `@rollkeeper/game-data`, process once at startup, cache in memory |
| Classes (15) | ~150KB | Bundle, process on demand |
| Bestiary (2000+) | ~15MB JSON | **Do NOT bundle.** Fetch from API with search/pagination. Add a bestiary API endpoint if one doesn't exist. |
| Races | ~500KB | Bundle |
| Backgrounds | ~900KB | Bundle |
| Feats | ~300KB | Bundle |
| Conditions | ~60KB | Bundle |

---

## 18. Navigation Architecture

### App-level: Tab navigator (Expo Router)

```
(tabs)/
├── index.tsx           → Characters tab (character list)
├── spellbook.tsx       → Spellbook tab (spell browser)
├── dice.tsx            → Dice tab (dice roller)
└── profile.tsx         → Profile tab (auth, settings)
```

### Stack screens (pushed on top of tabs)

```
character/
├── [id].tsx            → Character sheet
├── new.tsx             → Create character
└── [id]/
    └── spell/[spellId].tsx  → Spell detail from character context

spellbook/
└── [spellId].tsx       → Spell detail from spellbook

classes/
├── index.tsx           → Class compendium
└── [classId].tsx       → Class detail

bestiary/
├── index.tsx           → Bestiary browser
└── [monsterId].tsx     → Monster stat block
```

### Character sheet internal navigation

The web uses a tab bar inside the character sheet (`characterSheetTabs.tsx`). On mobile, there are a few options:

**Option A: Scrollable segments (recommended)**
A horizontal scrollable segment control at the top of the character sheet that switches between sections: Overview, Combat, Spells, Equipment, Features, Notes. Each section is a scroll view.

**Option B: Collapsible sections**
A single long scroll with collapsible accordion sections. Simpler but can get very long.

**Option C: Nested tabs**
A top tab navigator inside the character sheet screen. More iOS-native but adds navigation complexity.

→ **Recommendation:** Start with Option A. It mirrors the web's tab approach but works naturally on mobile.

---

## 19. Design System Translation

### Color tokens

Already set up in `constants/Colors.ts`. Maps to the web's design tokens:

| Web token (CSS var) | Mobile constant | Light | Dark |
|---|---|---|---|
| `--color-text-heading` | `Colors.light.text` | `#1e293b` | `#f1f5f9` |
| `--color-text-body` | `Colors.light.textSecondary` | `#475569` | `#cbd5e1` |
| `--color-bg-base` | `Colors.light.background` | `#f8fafc` | `#0f172a` |
| `--color-bg-surface` | `Colors.light.surface` | `#ffffff` | `#1e293b` |
| `--color-border` | `Colors.light.border` | `#e2e8f0` | `#334155` |
| `--color-brand-purple` | `brand.purple` | `#7c3aed` | `#7c3aed` |
| `--color-brand-blue` | `brand.blue` | `#3b82f6` | `#3b82f6` |

### Spacing scale

Add to `constants/Spacing.ts`:

```typescript
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};
```

### Typography scale

Add to `constants/Typography.ts`:

```typescript
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
};
```

### Tailwind → StyleSheet patterns

| Tailwind | StyleSheet |
|---|---|
| `rounded-xl` | `borderRadius: 12` |
| `p-4` | `padding: 16` |
| `gap-3` | `gap: 12` |
| `flex-row items-center` | `{ flexDirection: 'row', alignItems: 'center' }` |
| `text-sm text-slate-500` | `{ fontSize: 14, color: '#64748b' }` |
| `border border-slate-200` | `{ borderWidth: 1, borderColor: '#e2e8f0' }` |
| `shadow-sm` | `Platform.select({ ios: { shadowOffset, shadowOpacity }, android: { elevation: 2 } })` |

---

## 20. Shared Code Strategy

### Current state

All types and utilities are **local** to `apps/web/src/types/` and `apps/web/src/utils/`. Nothing player-specific is in the shared `packages/` today.

### Recommended approach

Create a new shared package: **`packages/shared`** (`@rollkeeper/shared`).

Move into it the pure, DOM-free code both apps need:

```
packages/shared/
├── package.json
├── tsconfig.json
├── index.ts
├── types/
│   ├── character.ts      ← from apps/web/src/types/character.ts
│   ├── spells.ts         ← from apps/web/src/types/spells.ts
│   ├── dice.ts           ← from apps/web/src/types/dice.ts
│   └── features.ts       ← from apps/web/src/types/features.ts
├── utils/
│   ├── calculations.ts   ← from apps/web/src/utils/calculations.ts
│   ├── diceUtils.ts      ← from apps/web/src/utils/diceUtils.ts
│   ├── hpCalculations.ts ← from apps/web/src/utils/hpCalculations.ts
│   ├── multiclass.ts     ← from apps/web/src/utils/multiclass.ts
│   ├── spellConversion.ts← from apps/web/src/utils/spellConversion.ts
│   └── constants.ts      ← from apps/web/src/utils/constants.ts
└── stores/
    ├── playerStore.ts     ← core logic (storage adapter injected)
    └── characterStore.ts  ← core logic (storage adapter injected)
```

**Alternative (simpler, start here):** Copy the files directly into `apps/mobile/` and refactor into a shared package later when the mobile app stabilizes. This avoids premature abstraction.

---

## 21. Testing Strategy

| Layer | Tool | Notes |
|---|---|---|
| Unit (utils, stores) | Vitest | Same tests as web for shared logic |
| Component | React Native Testing Library | RN-specific component tests |
| E2E | Maestro | Mobile E2E framework, YAML-based flows |
| Manual | Expo Go / Dev build | Test on real iOS/Android devices |

### Priority test scenarios

1. Create character → appears in list → open sheet → data persists after app restart.
2. Edit ability scores → modifiers recalculate → skills update.
3. Damage/heal HP → death saves trigger at 0 HP → long rest resets.
4. Add spell → cast spell → slot deducted → concentration tracked.
5. Export character → import on different device → data matches.
6. Sign in → join campaign → sync character → data appears for DM.

---

## 22. Open Questions

| # | Question | Impact | Notes |
|---|---|---|---|
| 1 | **Shared package or copy files?** Should we create `packages/shared` now or copy-then-refactor? | Architecture | Copy-first is faster; shared package is cleaner long-term. |
| 2 | **Bestiary data loading.** Bundle the full bestiary (~15MB) or require API? | Bundle size | Recommend API-based search. May need a new endpoint. |
| 3 | **Rich text on mobile.** Replace Tiptap with what? Markdown renderer, plain text, or RN rich text library? | Phase 3 | Start with markdown rendering, add editing later. |
| 4 | **Dice animation.** 2D animated dice, Lottie animation, or simple number display? | Phase 6 | Lottie is low effort + looks good. |
| 5 | **Offline sync strategy.** Queue API calls when offline and replay? | Phase 8 | Can defer — characters work locally without any API. |
| 6 | **EAS / app store timeline.** When do we want an actual App Store / Play Store build? | Phase 8 | Set up EAS early (Phase 0) but submit at Phase 4+. |
| 7 | **Character data format.** Is the web's `CharacterState` type stable or still evolving? | All phases | Stabilize the type before mobile relies on it. |
| 8 | **Socket.io on mobile.** Does `socket.io-client` work reliably on React Native with background/foreground transitions? | Phase 7 | Needs testing. May need reconnection logic. |
