'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { MagicItemLibrarySection } from '../MagicItemLibrary/MagicItemLibrarySection';
import { NPCDetailDialog } from '../NPCDetailDialog';
import { NPCFormDialog } from '../NPCFormDialog';
import { NpcSyncControls } from '../NpcSyncControls';
import { NpcLibraryFilters } from './NpcLibraryFilters';
import { NpcLibraryList, type NpcLibraryListProps } from './NpcLibraryList';
import { useFocusAfterRemove, useNpcLibraryFilters } from './NpcLibrary.hooks';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import { LIBRARY_COPY } from './NpcLibrary.utils';
import type { MagicItem } from '@/types/character';
import type {
  CampaignCreatureKind,
  CampaignNPC,
  NPCInventoryItem,
} from '@/types/encounter';
import type { SendItemTarget } from '../SendItemDialog';

const EMPTY_NPCS: CampaignNPC[] = [];
const EMPTY_PLAYERS: SendItemTarget[] = [];

type NpcFormData = Omit<
  CampaignNPC,
  'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
>;

export interface NpcLibrarySectionProps {
  campaignCode: string;
  /** Which library this section lists. Default `'npc'`. */
  kind?: CampaignCreatureKind;
  /** Mount the NPC sync card and the magic item library after it. Default true. */
  showLibraryExtras?: boolean;
  onSendItemToPlayer?: (item: NPCInventoryItem, npcName: string) => void;
  /** Default `[]`. */
  players?: SendItemTarget[];
  onGiveMagicItemToPlayer?: (
    item: MagicItem,
    target: SendItemTarget
  ) => Promise<void>;
}

/** A campaign's NPC or custom monster library, as a section of rows. */
export function NpcLibrarySection({
  campaignCode,
  kind = 'npc',
  showLibraryExtras = true,
  onSendItemToPlayer,
  players = EMPTY_PLAYERS,
  onGiveMagicItemToPlayer,
}: NpcLibrarySectionProps) {
  const allCreatures = useNPCStore(
    state => state.npcsByCampaign[campaignCode] ?? EMPTY_NPCS
  );
  const createNPC = useNPCStore(state => state.createNPC);
  const duplicateNPC = useNPCStore(state => state.duplicateNPC);
  const updateNPC = useNPCStore(state => state.updateNPC);
  const deleteNPC = useNPCStore(state => state.deleteNPC);
  const reorderNPCsSubset = useNPCStore(state => state.reorderNPCsSubset);
  const campaign = useDmStore(state =>
    state.campaigns.find(c => c.code === campaignCode)
  );
  const setDmDashboardUi = useDmStore(state => state.setDmDashboardUi);

  const npcs = useMemo(
    () => allCreatures.filter(npc => (npc.kind ?? 'npc') === kind),
    [allCreatures, kind]
  );
  const npcIds = useMemo(() => npcs.map(npc => npc.id), [npcs]);

  const [editingNpc, setEditingNpc] = useState<CampaignNPC | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Read live from the store so edits made in the dialog show at once.
  const detailNpc =
    useNPCStore(state =>
      selectedId
        ? state.npcsByCampaign[campaignCode]?.find(
            npc => npc.id === selectedId && (npc.kind ?? 'npc') === kind
          )
        : undefined
    ) ?? null;
  // Moved or deleted elsewhere: drop the selection.
  if (selectedId && !detailNpc) setSelectedId(null);

  const {
    searchQuery,
    setSearchQuery,
    activeTags,
    toggleTag,
    clearTags,
    clearFilters,
    allTags,
    filteredNpcs,
    groups,
  } = useNpcLibraryFilters(npcs);
  const { fallbackRef, registerTarget, removeThenFocus } =
    useFocusAfterRemove(npcIds);

  const copy = LIBRARY_COPY[kind];
  const n = npcs.length;
  // Fewer than two entries have nothing to reorder, so Reorder turns itself off.
  if (n < 2 && reordering) setReordering(false);
  const openKey = kind === 'monster' ? 'monsterSectionOpen' : 'npcSectionOpen';
  const groupKey =
    kind === 'monster'
      ? 'monsterCollapsedGroupNames'
      : 'npcCollapsedGroupNames';
  const open = campaign?.dmDashboardUi?.[openKey] ?? true;
  const savedCollapsedGroups = campaign?.dmDashboardUi?.[groupKey];

  const collapsedGroups = useMemo(
    () => new Set(savedCollapsedGroups ?? []),
    [savedCollapsedGroups]
  );
  const existingGroups = useMemo(
    () => [
      ...new Set(npcs.map(npc => npc.group).filter((g): g is string => !!g)),
    ],
    [npcs]
  );
  const visibleIds = useMemo(
    () =>
      (groups
        ? groups
            .filter(group => !collapsedGroups.has(group.name))
            .flatMap(group => group.npcs)
        : filteredNpcs
      ).map(npc => npc.id),
    [groups, filteredNpcs, collapsedGroups]
  );

  const handleCreate = () => {
    setEditingNpc(null);
    setFormOpen(true);
  };

  const handleEdit = (npc: CampaignNPC) => {
    setEditingNpc(npc);
    setFormOpen(true);
  };

  const handleSave = (data: NpcFormData) => {
    if (editingNpc) {
      updateNPC(campaignCode, editingNpc.id, { ...data, kind });
      return;
    }
    createNPC(campaignCode, { ...data, kind });
    // An empty library ignores its saved collapse, so open it for the first
    // entry instead of hiding what the DM just made.
    if (n === 0 && campaign?.dmDashboardUi?.[openKey] === false) {
      setDmDashboardUi(campaignCode, { [openKey]: true });
    }
  };

  const handleDuplicate = (npc: CampaignNPC) => {
    duplicateNPC(campaignCode, npc.id);
  };

  const handleMove = (npc: CampaignNPC) => {
    updateNPC(campaignCode, npc.id, {
      kind: kind === 'monster' ? 'npc' : 'monster',
    });
    setSelectedId(null);
  };

  const handleDelete = async (npc: CampaignNPC) => {
    const confirmed = await confirmDialog({
      title: `Delete ${npc.name}?`,
      message: copy.deleteMessage(npc.name),
      confirmLabel: copy.deleteConfirm,
      tone: 'danger',
    });
    if (!confirmed) return;
    setSelectedId(null);
    removeThenFocus(npc.id, visibleIds, () => deleteNPC(campaignCode, npc.id));
  };

  const handleUpdateInventory = (
    npcId: string,
    inventory: NPCInventoryItem[]
  ) => {
    updateNPC(campaignCode, npcId, { inventory });
  };

  const handleGroupCollapsedChange = (
    groupName: string,
    collapsed: boolean
  ) => {
    const next = new Set(savedCollapsedGroups ?? []);
    if (collapsed) next.add(groupName);
    else next.delete(groupName);
    setDmDashboardUi(campaignCode, { [groupKey]: Array.from(next) });
  };

  const handleReorder: NpcLibraryListProps['onReorder'] = (
    subsetIds,
    fromIndex,
    toIndex
  ) => reorderNPCsSubset(campaignCode, subsetIds, fromIndex, toIndex);

  const rowProps: NpcLibraryListProps['rowProps'] = npc => ({
    moveLabel: copy.moveLabel(npc.name),
    viewRef: registerTarget(npc.id),
    onView: () => setSelectedId(npc.id),
    onEdit: () => handleEdit(npc),
    onDuplicate: () => handleDuplicate(npc),
    onMove: () => handleMove(npc),
    onDelete: () => handleDelete(npc),
  });

  const handleClearFilters = () => {
    clearFilters();
    searchRef.current?.focus();
  };

  return (
    <>
      <Section
        level={2}
        wrapHeading
        heading={n ? `${copy.heading} (${n})` : copy.heading}
        collapsed={n ? !open : undefined}
        onCollapsedChange={
          n
            ? collapsed =>
                setDmDashboardUi(campaignCode, { [openKey]: !collapsed })
            : undefined
        }
        trailing={
          n ? (
            <>
              {n >= 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  selected={reordering}
                  aria-pressed={reordering}
                  onClick={() => setReordering(on => !on)}
                >
                  Reorder
                </Button>
              )}
              <Button
                size="sm"
                ref={fallbackRef}
                leftIcon={<Plus size={16} aria-hidden="true" />}
                onClick={handleCreate}
              >
                {copy.createLabel}
              </Button>
            </>
          ) : undefined
        }
      >
        {n === 0 ? (
          <div className="py-12 text-center">
            <h3 className="type-subheading text-heading">
              {copy.emptyHeading}
            </h3>
            <p className="type-body text-muted mt-2">{copy.emptyBody}</p>
            <Button className="mt-4" ref={fallbackRef} onClick={handleCreate}>
              {copy.createLabel}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <NpcLibraryFilters
              searchRef={searchRef}
              searchLabel={copy.searchLabel}
              searchPlaceholder={copy.searchPlaceholder}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              allTags={allTags}
              activeTags={activeTags}
              onToggleTag={toggleTag}
              onClearTags={clearTags}
            />
            {filteredNpcs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="type-body text-muted">{copy.noMatch}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={handleClearFilters}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <NpcLibraryList
                flat={filteredNpcs}
                groups={groups}
                collapsedGroups={collapsedGroups}
                onGroupCollapsedChange={handleGroupCollapsedChange}
                reordering={reordering}
                onReorder={handleReorder}
                rowProps={rowProps}
              />
            )}
          </div>
        )}
      </Section>

      <NPCFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        editingNpc={editingNpc}
        entityLabel={copy.entityLabel}
        existingGroups={existingGroups}
      />

      <NPCDetailDialog
        npc={detailNpc}
        open={!!detailNpc}
        onOpenChange={isOpen => {
          if (!isOpen) setSelectedId(null);
        }}
        onEdit={npc => {
          setSelectedId(null);
          handleEdit(npc);
        }}
        onDelete={handleDelete}
        onUpdateInventory={handleUpdateInventory}
        onSendItemToPlayer={onSendItemToPlayer}
      />

      {/*
        The card only reads the route-level NpcSyncProvider owner, mounted in
        app/dm/campaign/[code]/layout.tsx, so the hydration and autosave effects
        cover every /dm/campaign/[code]/* route that writes the NPC store
        (encounter HP/resources/abilities, combatant NPC create/delete, marker
        loot). Create stays reachable (the heading's trailing, or the empty
        state, which never collapses), so the card must mount outside the
        collapsible. It renders nothing while the client flag is off.
      */}
      {showLibraryExtras && <NpcSyncControls />}

      {showLibraryExtras && onGiveMagicItemToPlayer && (
        <MagicItemLibrarySection
          campaignCode={campaignCode}
          players={players}
          onGiveToPlayer={onGiveMagicItemToPlayer}
        />
      )}
    </>
  );
}
