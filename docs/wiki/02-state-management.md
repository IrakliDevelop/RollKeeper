# State Management

All client state is Zustand (`persist` middleware → localStorage, except where
a store has since been wired into the IndexedDB cutover — see
[03](03-persistence-and-storage-migration.md)). This is a bigger set of stores
than "the character store" — 11 persisted stores plus 2 non-persisted
coordination helpers, all in `src/store/`.

## Persisted stores

| Store | Scope | Persist key | Notes |
|---|---|---|---|
| `characterStore.ts` | Active character (one at a time), all game mechanics | `rollkeeper-character` | ~5,500 lines. Wired into IndexedDB cutover (`isBrowserCharacterCutoverParticipant`, `createPerCharacterStorage`, `armCanonicalPersistence`, watermarks) and cross-tab sync. Read [03](03-persistence-and-storage-migration.md) before editing persistence-adjacent code here. |
| `playerStore.ts` | Multi-character roster, player settings, avatar, campaign link per character | `rollkeeper-player-data` | Holds `characters: PlayerCharacter[]`, `activeCharacterId`, and `characterTombstones` (soft-delete with a `beforeImage` for undo). Wired to `createCharacterFamilyStateStorage` and `initCrossTabRosterSync`. |
| `dmStore.ts` | DM identity (auto-generated ID) and campaign list | DM storage key | |
| `encounterStore.ts` | Encounter entities (combat participants, initiative order, HP/conditions) | `rollkeeper-encounter-data` | Campaign-scoped. See encounter architecture notes below. |
| `npcStore.ts` | NPC library | NPC storage key | **Global, not campaign-scoped** — a saved NPC is available across all campaigns. |
| `battleMapStore.ts` | Active battle map state | Battlemap storage key | |
| `calendarStore.ts` | Campaign calendar | Calendar storage key | |
| `combatLogStore.ts` | Combat log entries | `rollkeeper-combat-log` | |
| `locationStore.ts` | Campaign locations | Location storage key | |
| `magicItemLibraryStore.ts` | DM's custom magic items | `rollkeeper-dm-magic-item-library` | Distinct from the read-only bestiary/items JSON data — this is DM-authored content. |

## Non-persisted coordination helpers

- `characterActionClassification.ts` — classifies a store mutation as a plain
  "action" vs. a synced "intent," feeding the single-writer cross-tab sync
  protocol.
- `characterIntentContext.ts` — tiny context exposing `getApplyingIntent`, so
  `characterStore` mutations know whether they're being applied from a remote
  intent (don't re-broadcast) vs. a genuine local user action (do broadcast).

## Encounter Tracker architecture

- NPCs/monsters convert to encounter entities via `monsterToEncounterEntity()`
  in `src/utils/encounterConverter.ts`, which accepts `statBlockOverride` /
  `initiativeModifierOverride` / `proficiencyBonusOverride` for the pre-add
  editor (abilities get rebuilt from the override via `buildAbilitiesFromStatBlock`).
- Bestiary action/trait text is stored as pre-rendered badge-span HTML
  (`parseReferences`); edit paths convert to plain text, and display re-badges
  via `src/utils/statBlockText.ts` (`renderStatBlockEntryText`).
- `MonsterStatBlock` is stored on the entity directly — no runtime API calls
  needed to render a stat block.
- Player entities sync live from Redis via `useCampaignSync` (see
  [04](04-campaign-sync-redis.md)); HP/AC/concentration/conditions merge in,
  but the DM cannot damage/heal a player entity (the player owns that). The DM
  can still add DM-only conditions (tagged `source: 'dm'`), which are
  preserved across syncs.

## Gotchas (learned the hard way — don't reintroduce)

- **Never write `?? []` inside a Zustand selector.** It creates a new array
  reference every render and causes an infinite loop. Guard against `undefined`
  at the point data is *read* into the selector's source, not in the selector
  itself.
- **Stat-block section loops on NPC data must guard `?? []`.** Persisted NPC
  configs predate newer stat-block fields; without the guard, a migration can
  wipe sections for existing saved NPCs.
- **ESLint hook rules** flag any destructured Zustand action starting with
  `use` as if it were a hook. Rename on destructure, e.g.
  `const { useAbility: expendAbility } = useNpcStore()`.
