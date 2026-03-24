# Campaign NPC System — Design Spec

## Overview

Upgrade the DM dashboard NPC feature from basic name+stats to a full-featured campaign-scoped NPC system with complete stat blocks, bestiary import, portrait images, lore, and combat integration.

## Goals

- DM can create NPCs with full D&D stat blocks (abilities, saves, skills, resistances, immunities, senses, traits, actions, reactions)
- DM can import any monster from the bestiary as an NPC base and customize it
- DM can upload a portrait image for each NPC
- DM can write rich-text lore for each NPC
- NPCs are scoped per campaign (not global)
- NPCs added to combat carry their full stat block into the encounter tracker
- Clicking an NPC card opens a detail popup with Stat Block and Lore tabs

## Data Model

### Extended `CampaignNPC` (in `src/types/encounter.ts`)

```typescript
export interface CampaignNPC {
  id: string;
  campaignCode: string;
  name: string;
  description?: string;

  // Core combat stats (always present)
  armorClass: number;
  maxHp: number;
  speed: string;

  // Full stat block (present if imported from bestiary or manually filled)
  monsterStatBlock?: MonsterStatBlock;
  bestiarySourceId?: string;

  // Lore (optional, DM-written HTML from TipTap)
  loreHtml?: string;

  // Portrait (S3 URL)
  avatarUrl?: string;

  // Legacy fields kept for backward compat during migration
  abilityScores?: {
    str: number; dex: number; con: number;
    int: number; wis: number; cha: number;
  };
  traits?: string[];
  actions?: string[];

  createdAt: string;
  updatedAt: string;
}
```

`MonsterStatBlock` already carries: str/dex/con/int/wis/cha, saves, skills, speed, resistances, immunities, vulnerabilities, conditionImmunities, senses, passivePerception, traits, actions, reactions, cr, type, size, languages, alignment, hpFormula.

Once an NPC has `monsterStatBlock`, the legacy `abilityScores`/`traits`/`actions` fields are redundant but harmless.

### Store Changes (`src/store/npcStore.ts`)

Current shape: `{ npcs: CampaignNPC[] }` (flat global list).

New shape:

```typescript
interface NPCStoreState {
  npcsByCampaign: Record<string, CampaignNPC[]>;

  createNPC: (campaignCode: string, npc: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>) => string;
  updateNPC: (campaignCode: string, id: string, updates: Partial<CampaignNPC>) => void;
  deleteNPC: (campaignCode: string, id: string) => void;
  getNPC: (campaignCode: string, id: string) => CampaignNPC | undefined;
  getNPCsForCampaign: (campaignCode: string) => CampaignNPC[];
}
```

Storage version bumps from 1 → 2 with a migration:
- Existing `npcs[]` items move into `npcsByCampaign["_legacy"]`
- Items that already have a `campaignCode` go to their proper bucket

## NPC Create/Edit Form (redesigned `NPCFormDialog`)

Dialog size: `sm:max-w-2xl` with scrollable body.

### Two creation paths

**Path A — Import from Bestiary:**
- Autocomplete search field at the top using `/api/bestiary/search` (same endpoint as `AddEntityDialog`)
- Selecting a monster auto-fills all fields and sets `bestiarySourceId`
- All fields remain editable after import

**Path B — Manual creation:**
- Same form layout as `CreatureCreatorForm` adapted for the NPC context
- Sections: name, size/type/alignment, AC/HP/HP formula/speed, 6 ability scores, saves/skills/resistances/immunities/vulnerabilities/condition immunities/senses/languages/CR, traits/actions/reactions (name+text entries with `CompactRichTextEditor`)

### Shared sections (both paths)

- **Portrait upload** — image picker using `AvatarUpload` pattern, hits `/api/npc/upload` route
- **Lore** — collapsible section at the bottom, uses `CompactRichTextEditor`, stores as HTML string in `loreHtml`

## NPC Detail Popup (`NPCDetailDialog`)

Opened when DM clicks an NPC card. Two tabs:

**Tab 1 — Stat Block & Actions:**
- Portrait + name header with CR badge and type line
- Renders `MonsterStatBlockPanel` if `monsterStatBlock` exists
- Falls back to basic stats display (AC, HP, speed, optional ability scores) for NPCs without a full stat block

**Tab 2 — Lore:**
- Renders `loreHtml` via `dangerouslySetInnerHTML` (DM-only content, trusted)
- Empty state: "No lore written yet" with Edit button

Edit button in header opens the edit form dialog.

## NPC Cards (`NPCSection` / `NPCCard`)

Enhanced from current minimal cards:
- Portrait thumbnail (if set)
- CR badge and type line (if stat block exists)
- Click opens `NPCDetailDialog`
- Edit/delete actions via hover icons or inside the detail popup

## Combat Integration

`handleAddNpc` in `AddEntityDialog` updated to pass `monsterStatBlock` when present:

```typescript
const handleAddNpc = (npc: CampaignNPC) => {
  onAddEntity({
    type: 'npc',
    name: npc.name,
    initiative: null,
    initiativeModifier: npc.monsterStatBlock
      ? Math.floor((npc.monsterStatBlock.dex - 10) / 2)
      : npc.abilityScores
        ? Math.floor((npc.abilityScores.dex - 10) / 2)
        : 0,
    currentHp: npc.maxHp,
    maxHp: npc.maxHp,
    tempHp: 0,
    armorClass: npc.armorClass,
    conditions: [],
    isHidden: false,
    monsterStatBlock: npc.monsterStatBlock,
  });
};
```

This gives NPCs in combat the same stat block panel, ability tracking, and display as bestiary monsters.

## S3 Portrait Upload

### New API route: `/api/npc/upload` (POST)

- Accepts `file` (image) + `npcId` form fields
- Validates: image MIME type, max 5MB
- Uploads to S3 key: `npc-portraits/{npcId}-{timestamp}.{ext}`
- Returns `{ url }` on success

### New API route: `/api/npc/delete` (DELETE)

- Accepts `url` query param
- Extracts S3 key, deletes from bucket
- Same pattern as `/api/avatar/delete`

## Component Inventory

| Component | Status | Notes |
|---|---|---|
| `CampaignNPC` type | Extend | Add `campaignCode`, `monsterStatBlock`, `bestiarySourceId`, `loreHtml` |
| `npcStore` | Rewrite | Campaign-scoped, version 2 migration |
| `NPCFormDialog` | Rewrite | Two-path form (bestiary import / manual), portrait, lore |
| `NPCDetailDialog` | New | Two-tab detail popup (Stats / Lore) |
| `NPCSection` | Update | Pass `campaignCode`, open detail popup on click |
| `NPCCard` | Update | Portrait thumbnail, CR badge, click → detail |
| `AddEntityDialog` | Update | Pass `monsterStatBlock` in `handleAddNpc` |
| `/api/npc/upload` | New | S3 upload route for NPC portraits |
| `/api/npc/delete` | New | S3 delete route for NPC portraits |
| `MonsterStatBlockPanel` | Reuse | Already works, no changes needed |
| `CompactRichTextEditor` | Reuse | For lore and action descriptions |

## Migration

- `npcStore` version 1 → 2: move flat `npcs[]` into `npcsByCampaign` map
- Existing NPCs without `campaignCode` go to `"_legacy"` bucket
- `NPCSection` (rendered inside campaign page) passes `campaignCode` from URL params
- `_legacy` NPCs could optionally appear in all campaigns with a UI hint to reassign

## Out of Scope

- Sharing NPCs across campaigns (future)
- NPC combat AI / behavior automation
- Linking NPCs to encounter templates
- Bestiary "live link" (stat block is snapshot at import time, not live-updated)
