# Campaign NPC System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade DM campaign NPCs to support full stat blocks, bestiary import, S3 portrait images, rich-text lore, campaign scoping, and combat integration.

**Architecture:** Extend the existing `CampaignNPC` type with `monsterStatBlock`, `loreHtml`, `bestiarySourceId`, and `campaignCode`. Rewrite `npcStore` to key NPCs by campaign. Add S3 routes for NPC portrait upload/delete. Rewrite the NPC form dialog with bestiary autocomplete and full manual entry. Add a two-tab detail popup. Update combat integration to carry stat blocks.

**Tech Stack:** Next.js App Router, Zustand (persist middleware), TipTap (CompactRichTextEditor), AWS S3, existing design system components.

**Spec:** `docs/superpowers/specs/2026-03-24-campaign-npc-system-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/encounter.ts` | Modify | Add fields to `CampaignNPC` interface |
| `src/store/npcStore.ts` | Rewrite | Campaign-scoped store with v1→v2 migration |
| `src/store/__tests__/npcStore.test.ts` | Rewrite | Tests for new campaign-scoped API |
| `src/utils/s3Upload.ts` | Modify | Add `uploadNpcPortraitToS3` + `generateNpcPortraitFileName` |
| `src/app/api/npc/upload/route.ts` | Create | POST route for NPC portrait upload |
| `src/app/api/npc/delete/route.ts` | Create | DELETE route for NPC portrait cleanup |
| `src/components/ui/campaign/NPCFormDialog.tsx` | Rewrite | Two-path form (bestiary/manual), portrait, lore |
| `src/components/ui/campaign/NPCDetailDialog.tsx` | Create | Two-tab detail popup (Stats / Lore) |
| `src/components/ui/campaign/NPCSection.tsx` | Rewrite | Campaign-scoped, enhanced cards, detail popup |
| `src/components/ui/encounter/AddEntityDialog.tsx` | Modify | Pass `monsterStatBlock` in `handleAddNpc` |

---

## Task 1: Extend the CampaignNPC Type

**Files:**
- Modify: `src/types/encounter.ts` (lines 165–193, the `CampaignNPC` interface)

- [ ] **Step 1: Add new fields to CampaignNPC**

In `src/types/encounter.ts`, replace the `CampaignNPC` interface with:

```typescript
export interface CampaignNPC {
  id: string;
  campaignCode: string;
  name: string;
  description?: string;

  // Core combat stats
  armorClass: number;
  maxHp: number;
  speed: string;

  // Full stat block (from bestiary import or manual entry)
  monsterStatBlock?: MonsterStatBlock;
  bestiarySourceId?: string;

  // Lore (DM-written HTML from rich text editor)
  loreHtml?: string;

  // Portrait (S3 URL)
  avatarUrl?: string;

  // Legacy fields (backward compat, superseded by monsterStatBlock when present)
  abilityScores?: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  traits?: string[];
  actions?: string[];

  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Run type-check to verify no compile errors**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Errors in files that use `createNPC` / `updateNPC` without `campaignCode` — this is expected and will be fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add src/types/encounter.ts
git commit -m "feat(npc): add campaignCode, monsterStatBlock, loreHtml to CampaignNPC type"
```

---

## Task 2: Rewrite npcStore for Campaign Scoping

**Files:**
- Rewrite: `src/store/npcStore.ts`

- [ ] **Step 1: Rewrite the store with campaign-scoped data**

Replace `src/store/npcStore.ts` entirely:

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CampaignNPC } from '@/types/encounter';

const NPC_STORAGE_KEY = 'rollkeeper-npc-data';

function generateId(): string {
  return (
    'npc-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
}

interface NPCStoreState {
  npcsByCampaign: Record<string, CampaignNPC[]>;

  createNPC: (
    campaignCode: string,
    npc: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>
  ) => string;
  updateNPC: (
    campaignCode: string,
    id: string,
    updates: Partial<CampaignNPC>
  ) => void;
  deleteNPC: (campaignCode: string, id: string) => void;
  getNPC: (campaignCode: string, id: string) => CampaignNPC | undefined;
  getNPCsForCampaign: (campaignCode: string) => CampaignNPC[];
}

export const useNPCStore = create<NPCStoreState>()(
  persist(
    (set, get) => ({
      npcsByCampaign: {},

      createNPC: (campaignCode, npcData) => {
        const id = generateId();
        const now = new Date().toISOString();
        const npc: CampaignNPC = {
          ...npcData,
          id,
          campaignCode,
          createdAt: now,
          updatedAt: now,
        };
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: [...existing, npc],
            },
          };
        });
        return id;
      },

      updateNPC: (campaignCode, id, updates) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.map(npc =>
                npc.id === id
                  ? { ...npc, ...updates, updatedAt: new Date().toISOString() }
                  : npc
              ),
            },
          };
        });
      },

      deleteNPC: (campaignCode, id) => {
        set(state => {
          const existing = state.npcsByCampaign[campaignCode] ?? [];
          return {
            npcsByCampaign: {
              ...state.npcsByCampaign,
              [campaignCode]: existing.filter(npc => npc.id !== id),
            },
          };
        });
      },

      getNPC: (campaignCode, id) => {
        return (get().npcsByCampaign[campaignCode] ?? []).find(
          npc => npc.id === id
        );
      },

      getNPCsForCampaign: campaignCode => {
        return get().npcsByCampaign[campaignCode] ?? [];
      },
    }),
    {
      name: NPC_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) {
          const old = persisted as { npcs?: CampaignNPC[] } | null;
          const legacyNpcs = old?.npcs ?? [];
          const npcsByCampaign: Record<string, CampaignNPC[]> = {};

          for (const npc of legacyNpcs) {
            const code = (npc as CampaignNPC & { campaignCode?: string }).campaignCode ?? '_legacy';
            if (!npcsByCampaign[code]) npcsByCampaign[code] = [];
            npcsByCampaign[code].push({ ...npc, campaignCode: code });
          }

          return { npcsByCampaign };
        }
        return persisted as NPCStoreState;
      },
    }
  )
);

export default useNPCStore;
```

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit 2>&1 | head -40`
Expected: Errors in consumer files (`NPCSection.tsx`, `AddEntityDialog.tsx`) because call signatures changed — fixed in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/store/npcStore.ts
git commit -m "feat(npc): rewrite npcStore for campaign-scoped NPC storage with v1→v2 migration"
```

---

## Task 3: Update npcStore Tests

**Files:**
- Rewrite: `src/store/__tests__/npcStore.test.ts`

- [ ] **Step 1: Rewrite tests for the new campaign-scoped API**

Replace `src/store/__tests__/npcStore.test.ts` with:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useNPCStore } from '@/store/npcStore';

const CAMPAIGN = 'test-campaign';

describe('npcStore (campaign-scoped)', () => {
  beforeEach(() => {
    useNPCStore.setState({ npcsByCampaign: {} });
  });

  describe('createNPC', () => {
    it('returns an id and adds the NPC to the campaign bucket', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Bartender Bob',
        armorClass: 10,
        maxHp: 8,
        speed: '30 ft.',
      });

      expect(id).toMatch(/^npc-/);
      const npcs = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN);
      expect(npcs).toHaveLength(1);
      expect(npcs[0].name).toBe('Bartender Bob');
      expect(npcs[0].campaignCode).toBe(CAMPAIGN);
    });

    it('sets createdAt and updatedAt timestamps', () => {
      useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Guard',
        armorClass: 16,
        maxHp: 11,
        speed: '30 ft.',
      });

      const npc = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)[0];
      expect(npc.createdAt).toBeTruthy();
      expect(npc.updatedAt).toBeTruthy();
      expect(npc.createdAt).toBe(npc.updatedAt);
    });

    it('isolates NPCs between campaigns', () => {
      useNPCStore.getState().createNPC('campaign-a', {
        name: 'NPC A',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC('campaign-b', {
        name: 'NPC B',
        armorClass: 12,
        maxHp: 10,
        speed: '25 ft.',
      });

      expect(useNPCStore.getState().getNPCsForCampaign('campaign-a')).toHaveLength(1);
      expect(useNPCStore.getState().getNPCsForCampaign('campaign-b')).toHaveLength(1);
      expect(useNPCStore.getState().getNPCsForCampaign('campaign-a')[0].name).toBe('NPC A');
    });
  });

  describe('updateNPC', () => {
    it('merges updates and preserves unchanged fields', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Old Name',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      useNPCStore.getState().updateNPC(CAMPAIGN, id, { name: 'New Name', armorClass: 14 });

      const npc = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)[0];
      expect(npc.name).toBe('New Name');
      expect(npc.armorClass).toBe(14);
      expect(npc.maxHp).toBe(5);
    });

    it('does not affect other NPCs', () => {
      const id1 = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'First',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });
      useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Second',
        armorClass: 12,
        maxHp: 10,
        speed: '30 ft.',
      });

      useNPCStore.getState().updateNPC(CAMPAIGN, id1, { name: 'Updated First' });

      const npcs = useNPCStore.getState().getNPCsForCampaign(CAMPAIGN);
      expect(npcs[0].name).toBe('Updated First');
      expect(npcs[1].name).toBe('Second');
    });
  });

  describe('deleteNPC', () => {
    it('removes the NPC by id within the campaign', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Doomed NPC',
        armorClass: 10,
        maxHp: 1,
        speed: '30 ft.',
      });

      useNPCStore.getState().deleteNPC(CAMPAIGN, id);
      expect(useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)).toHaveLength(0);
    });

    it('is a no-op for unknown id', () => {
      useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Safe NPC',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      useNPCStore.getState().deleteNPC(CAMPAIGN, 'nonexistent');
      expect(useNPCStore.getState().getNPCsForCampaign(CAMPAIGN)).toHaveLength(1);
    });
  });

  describe('getNPC', () => {
    it('returns matching NPC within the campaign', () => {
      const id = useNPCStore.getState().createNPC(CAMPAIGN, {
        name: 'Findable',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      const found = useNPCStore.getState().getNPC(CAMPAIGN, id);
      expect(found?.name).toBe('Findable');
    });

    it('returns undefined for unknown id', () => {
      const found = useNPCStore.getState().getNPC(CAMPAIGN, 'nonexistent');
      expect(found).toBeUndefined();
    });

    it('returns undefined when searching wrong campaign', () => {
      const id = useNPCStore.getState().createNPC('campaign-a', {
        name: 'Wrong Campaign',
        armorClass: 10,
        maxHp: 5,
        speed: '30 ft.',
      });

      const found = useNPCStore.getState().getNPC('campaign-b', id);
      expect(found).toBeUndefined();
    });
  });

  describe('getNPCsForCampaign', () => {
    it('returns empty array for unknown campaign', () => {
      expect(useNPCStore.getState().getNPCsForCampaign('unknown')).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/store/__tests__/npcStore.test.ts`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/store/__tests__/npcStore.test.ts
git commit -m "test(npc): rewrite npcStore tests for campaign-scoped API"
```

---

## Task 4: Add S3 NPC Portrait Upload/Delete

**Files:**
- Modify: `src/utils/s3Upload.ts` (append two functions)
- Create: `src/app/api/npc/upload/route.ts`
- Create: `src/app/api/npc/delete/route.ts`

- [ ] **Step 1: Add upload and filename helpers to s3Upload.ts**

Append to `src/utils/s3Upload.ts` (after the existing `generateBannerFileName` function):

```typescript
/**
 * Upload an NPC portrait image to S3
 */
export async function uploadNpcPortraitToS3(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  const key = `npc-portraits/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
  });

  try {
    await s3Client.send(command);
    const url = `https://${BUCKET_NAME}.s3.${AWS_S3_REGION}.amazonaws.com/${key}`;
    return url;
  } catch (error) {
    console.error('Error uploading NPC portrait to S3:', error);
    throw new Error('Failed to upload NPC portrait to S3');
  }
}

/**
 * Generate a unique filename for an NPC portrait
 */
export function generateNpcPortraitFileName(
  npcId: string,
  originalName: string
): string {
  const timestamp = Date.now();
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
  let extension = originalName.split('.').pop() || '';
  extension = extension.toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    extension = 'jpg';
  }
  return `${npcId}-${timestamp}.${extension}`;
}
```

- [ ] **Step 2: Create the upload API route**

Create `src/app/api/npc/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import {
  uploadNpcPortraitToS3,
  generateNpcPortraitFileName,
} from '@/utils/s3Upload';

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const npcId = formData.get('npcId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!npcId) {
      return NextResponse.json(
        { error: 'NPC ID is required' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File size must be less than ${MAX_FILE_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = generateNpcPortraitFileName(npcId, file.name);
    const url = await uploadNpcPortraitToS3(buffer, fileName, file.type);

    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
    console.error('NPC portrait upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload NPC portrait' },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create the delete API route**

Create `src/app/api/npc/delete/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { deleteAvatarFromS3 } from '@/utils/s3Upload';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'No URL provided' },
        { status: 400 }
      );
    }

    await deleteAvatarFromS3(url);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('NPC portrait deletion error:', error);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
```

Note: `deleteAvatarFromS3` is generic — it extracts the key from any S3 URL and deletes it. Works for any prefix.

- [ ] **Step 4: Run type-check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors from these files. (Existing errors from consumer components are expected until Tasks 5-8.)

- [ ] **Step 5: Commit**

```bash
git add src/utils/s3Upload.ts src/app/api/npc/upload/route.ts src/app/api/npc/delete/route.ts
git commit -m "feat(npc): add S3 upload/delete API routes for NPC portraits"
```

---

## Task 5: Rewrite NPCFormDialog

**Files:**
- Rewrite: `src/components/ui/campaign/NPCFormDialog.tsx`

This is the largest task. The dialog supports two paths: bestiary import (autocomplete → auto-fill) and manual entry. Both share portrait upload and lore sections.

**Key dependencies used:**
- `/api/bestiary/search` — same endpoint `AddEntityDialog` uses for monster search
- `buildMonsterStatBlock` from `src/utils/encounterConverter.ts` — needs to be exported (currently private)
- `CompactRichTextEditor` from `@/components/ui/forms/CompactRichTextEditor`
- `MonsterStatBlock` from `@/types/encounter`
- `ProcessedMonster` from `@/types/bestiary`
- Design system: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogBody`, `Button`, `Input`, `SelectField`, `SelectItem`

- [ ] **Step 1: Export `buildMonsterStatBlock` from encounterConverter**

In `src/utils/encounterConverter.ts`, change line 181 from:

```typescript
function buildMonsterStatBlock(
```

to:

```typescript
export function buildMonsterStatBlock(
```

- [ ] **Step 2: Rewrite NPCFormDialog**

Replace `src/components/ui/campaign/NPCFormDialog.tsx` with the full two-path form. The component structure:

1. **Header** with title ("Create NPC" / "Edit NPC")
2. **Bestiary import section** — search input with debounced fetch to `/api/bestiary/search`, dropdown results, clicking a result calls `buildMonsterStatBlock` and auto-fills all fields
3. **Portrait upload** — file input that POSTs to `/api/npc/upload`, displays thumbnail preview
4. **Name + description fields**
5. **Core stats section** — Size, Type, Alignment, AC, HP, HP Formula, Speed (same layout as `CreatureCreatorForm`)
6. **Ability scores** — 6-column grid (same layout as `CreatureCreatorForm`)
7. **Details** — Saves, Skills, Resistances, Immunities, Vulnerabilities, Condition Immunities, Senses, Languages, CR (same 2-col layout as `CreatureCreatorForm`)
8. **Traits / Actions / Reactions** — reusable `AbilityListEditor` with name+text entries using `CompactRichTextEditor` (same pattern as `CreatureCreatorForm`)
9. **Lore section** — collapsible, `CompactRichTextEditor` for `loreHtml`
10. **Save / Cancel buttons**

The dialog should be `sm:max-w-2xl` with a scrollable `DialogBody` (`max-h-[70vh] overflow-y-auto`).

**Props interface:**
```typescript
interface NPCFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>) => void;
  editingNpc?: CampaignNPC | null;
}
```

The `onSave` callback returns the NPC data without `id`/`campaignCode`/timestamps — the parent (`NPCSection`) handles calling `createNPC(campaignCode, data)` or `updateNPC(campaignCode, id, data)`.

When building the save payload, assemble a `MonsterStatBlock` from the form fields (mirroring `CreatureCreatorForm`'s `handleSubmit` → `savedCreatureToStatBlock` pattern). If all stat-block fields are at defaults and empty, omit `monsterStatBlock` for lightweight NPCs.

Implementation note: Extract the `AbilityListEditor` sub-component from `CreatureCreatorForm.tsx` into a shared location or duplicate it locally (keeping DRY — if identical, import from `CreatureCreatorForm`). Since `CreatureCreatorForm` already exports it implicitly as part of the file, and extracting it would change that file, the pragmatic approach is to define it locally in `NPCFormDialog.tsx` — the two are small enough that a minor duplication is acceptable.

- [ ] **Step 3: Run type-check and lint**

Run: `npx tsc --noEmit 2>&1 | head -30`
Run: `npx eslint src/components/ui/campaign/NPCFormDialog.tsx --fix`

- [ ] **Step 4: Commit**

```bash
git add src/utils/encounterConverter.ts src/components/ui/campaign/NPCFormDialog.tsx
git commit -m "feat(npc): rewrite NPCFormDialog with bestiary import, full stat block, portrait, lore"
```

---

## Task 6: Create NPCDetailDialog

**Files:**
- Create: `src/components/ui/campaign/NPCDetailDialog.tsx`

Two-tab detail popup (Stat Block / Lore) with edit and delete actions in the header.

**Structure:**
1. `Dialog` / `DialogContent` (`sm:max-w-2xl`)
2. Header: portrait (if present, rendered as a circular thumbnail), NPC name, CR badge + type line from stat block
3. Tab bar: "Stat Block" | "Lore" (simple custom tabs like the encounter entity tabs, using buttons + conditional rendering)
4. **Stat Block tab:**
   - If `monsterStatBlock` exists → render `MonsterStatBlockPanel` (read-only, no `onUpdate`)
   - Else → render basic stats: HP, AC, Speed, optional ability scores grid, description
5. **Lore tab:**
   - If `loreHtml` exists → render via `dangerouslySetInnerHTML` inside a `prose` styled div
   - Else → empty state with "No lore yet" message
6. Footer: "Edit" button (triggers `onEdit` callback), "Delete" button (triggers `onDelete` callback)

**Props:**
```typescript
interface NPCDetailDialogProps {
  npc: CampaignNPC | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (npc: CampaignNPC) => void;
  onDelete: (npc: CampaignNPC) => void;
}
```

- [ ] **Step 1: Create NPCDetailDialog component**

Create `src/components/ui/campaign/NPCDetailDialog.tsx` with the structure above.

- [ ] **Step 2: Run type-check and lint**

Run: `npx tsc --noEmit 2>&1 | grep NPCDetailDialog`
Run: `npx eslint src/components/ui/campaign/NPCDetailDialog.tsx --fix`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/campaign/NPCDetailDialog.tsx
git commit -m "feat(npc): add NPCDetailDialog with stat block and lore tabs"
```

---

## Task 7: Update NPCSection and NPCCard

**Files:**
- Rewrite: `src/components/ui/campaign/NPCSection.tsx`

Key changes:
1. Accept `campaignCode` prop (passed from campaign page)
2. Use `getNPCsForCampaign(campaignCode)` instead of flat `npcs`
3. Pass `campaignCode` to `createNPC` and `updateNPC` and `deleteNPC`
4. Add state for `NPCDetailDialog` — `selectedNpc`
5. Click on card → opens `NPCDetailDialog` (not edit dialog)
6. Edit/delete actions come from detail dialog callbacks

`NPCCard` enhancements (stays inline in the same file):
- Show portrait thumbnail (if `avatarUrl` exists) — small circular image at left
- Show CR badge and type info (if `monsterStatBlock` exists)
- Entire card is clickable (opens detail popup)
- Edit/delete icon buttons on hover (for quick access)

**Updated props for NPCSection:**
```typescript
interface NPCSectionProps {
  campaignCode: string;
}
```

- [ ] **Step 1: Rewrite NPCSection with campaign scoping and detail dialog**

Replace `src/components/ui/campaign/NPCSection.tsx`. Key imports to add: `NPCDetailDialog`, `useState` for `selectedNpc`.

Update `handleSave` signature: `createNPC(campaignCode, data)` and `updateNPC(campaignCode, editingNpc.id, data)`.

Update `handleDelete`: `deleteNPC(campaignCode, npc.id)`.

Add `selectedNpc` state + `NPCDetailDialog` in the JSX.

- [ ] **Step 2: Update the campaign page to pass campaignCode**

In `src/app/dm/campaign/[code]/page.tsx`, the `<NPCSection />` call (around line 408) needs to pass `campaignCode`:

Change:
```tsx
{!loading && !error && <NPCSection />}
```
To:
```tsx
{!loading && !error && <NPCSection campaignCode={code} />}
```

- [ ] **Step 3: Run type-check and lint**

Run: `npx tsc --noEmit 2>&1 | head -30`
Run: `npx eslint src/components/ui/campaign/NPCSection.tsx src/app/dm/campaign/\[code\]/page.tsx --fix`

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/campaign/NPCSection.tsx src/app/dm/campaign/\[code\]/page.tsx
git commit -m "feat(npc): campaign-scoped NPCSection with detail dialog and enhanced cards"
```

---

## Task 8: Update Combat Integration (AddEntityDialog)

**Files:**
- Modify: `src/components/ui/encounter/AddEntityDialog.tsx`

Two changes:
1. The `handleAddNpc` function (around line 185) needs to pass `monsterStatBlock` when available
2. The NPC tab's inline "create NPC" form needs updated call signature for `createNPC`

- [ ] **Step 1: Update handleAddNpc to pass stat block**

In `src/components/ui/encounter/AddEntityDialog.tsx`, update the `handleAddNpc` function:

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

- [ ] **Step 2: Update NPC creation call in the NPC tab**

The inline NPC creation form in `AddEntityDialog` calls `createNPC(...)` (around line 204). This needs to include the `campaignCode` as the first argument. The `campaignCode` is already available as the `campaignCode` prop.

Change:
```typescript
createNPC({
  name: npcName.trim(),
  maxHp: parseInt(npcHp) || 10,
  armorClass: parseInt(npcAc) || 10,
  speed: npcSpeed.trim() || '30 ft.',
  description: npcDescription.trim() || undefined,
});
```

To:
```typescript
if (!campaignCode) return;
createNPC(campaignCode, {
  name: npcName.trim(),
  maxHp: parseInt(npcHp) || 10,
  armorClass: parseInt(npcAc) || 10,
  speed: npcSpeed.trim() || '30 ft.',
  description: npcDescription.trim() || undefined,
});
```

- [ ] **Step 3: Update NPC list source to use campaign-scoped getter**

The `storedNpcs` variable (around line 98) uses the old `npcs` from the store. Update:

Change:
```typescript
const { npcs: storedNpcs, createNPC, deleteNPC } = useNPCStore();
```

To:
```typescript
const { getNPCsForCampaign, createNPC, deleteNPC } = useNPCStore();
const storedNpcs = campaignCode ? getNPCsForCampaign(campaignCode) : [];
```

Also update the `deleteNPC` call in the NPC tab to include `campaignCode`:
```typescript
deleteNPC(campaignCode!, npc.id)
```

- [ ] **Step 4: Update EncounterView NPC passthrough**

In `src/components/ui/encounter/EncounterView.tsx` (around line 7/65), the `npcs` from `useNPCStore` is passed to `AddEntityDialog`. Update to use `getNPCsForCampaign`:

```typescript
const { getNPCsForCampaign } = useNPCStore();
const npcs = campaignCode ? getNPCsForCampaign(campaignCode) : [];
```

- [ ] **Step 5: Run full type-check and tests**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npx vitest run src/store/__tests__/npcStore.test.ts`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/encounter/AddEntityDialog.tsx src/components/ui/encounter/EncounterView.tsx
git commit -m "feat(npc): pass full monsterStatBlock when adding NPCs to combat, campaign-scope encounter NPC access"
```

---

## Task 9: Final Integration Verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: No lint errors.

- [ ] **Step 4: Manual smoke test checklist**

Open the app at a campaign page (`/dm/campaign/[code]`):
1. Verify "Create NPC" button appears
2. Create an NPC manually with full stats → verify card shows portrait placeholder, CR badge, type
3. Click the NPC card → verify detail popup opens with Stat Block tab
4. Switch to Lore tab → verify empty state
5. Edit NPC → add lore text → save → verify Lore tab shows content
6. Import an NPC from bestiary → verify all fields auto-populate
7. Add an NPC to combat encounter → verify stat block panel appears in encounter tracker
8. Delete an NPC → verify removal
9. Navigate to a different campaign → verify NPCs are isolated per campaign
