'use client';

import { useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useDmStore } from '@/store/dmStore';
import { useNPCStore } from '@/store/npcStore';
import type { MagicItem } from '@/types/character';
import type { CampaignNPC } from '@/types/encounter';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import type { SendItemTarget } from '../SendItemDialog';
import { useFocusAfterRemove } from '../NpcLibrary/NpcLibrary.hooks';
import { GiveMagicItemDialog, type GiveRecipient } from './GiveMagicItemDialog';
import { MagicItemLibraryDialog } from './MagicItemLibraryDialog';
import { MagicItemLibraryRow } from './MagicItemLibraryRow';
import { MagicItemSyncControls } from './MagicItemSyncControls';

const EMPTY_MAGIC_ITEMS: CustomMagicItem[] = [];
const EMPTY_NPCS: CampaignNPC[] = [];

export function MagicItemLibrarySection({
  campaignCode,
  players,
  onGiveToPlayer,
}: {
  campaignCode: string;
  players: SendItemTarget[];
  onGiveToPlayer: (item: MagicItem, target: SendItemTarget) => Promise<void>;
}) {
  const items = useMagicItemLibraryStore(
    state => state.itemsByCampaign[campaignCode] ?? EMPTY_MAGIC_ITEMS
  );
  const createItem = useMagicItemLibraryStore(state => state.createItem);
  const updateItem = useMagicItemLibraryStore(state => state.updateItem);
  const deleteItem = useMagicItemLibraryStore(state => state.deleteItem);
  const duplicateItem = useMagicItemLibraryStore(state => state.duplicateItem);
  const npcs = useNPCStore(
    state => state.npcsByCampaign[campaignCode] ?? EMPTY_NPCS
  );
  const updateNPC = useNPCStore(state => state.updateNPC);
  const campaign = useDmStore(state =>
    state.campaigns.find(entry => entry.code === campaignCode)
  );
  const setDmDashboardUi = useDmStore(state => state.setDmDashboardUi);
  const sectionOpen =
    campaign?.dmDashboardUi?.magicItemLibrarySectionOpen ?? true;
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('all');
  const [editing, setEditing] = useState<CustomMagicItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [givingItem, setGivingItem] = useState<CustomMagicItem | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const tags = useMemo(
    () => [...new Set(items.flatMap(item => item.tags))].sort(),
    [items]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(
      item =>
        (tag === 'all' || item.tags.includes(tag)) &&
        (!needle ||
          [item.name, item.group, item.rarity, item.category, ...item.tags]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(needle))
    );
  }, [items, query, tag]);
  const itemIds = useMemo(() => items.map(item => item.id), [items]);
  const filteredIds = useMemo(() => filtered.map(item => item.id), [filtered]);
  const { fallbackRef, registerTarget, removeThenFocus, focusWhenPresent } =
    useFocusAfterRemove(itemIds);
  const n = items.length;
  // An empty library hides its filters, so a stale search must not hide the
  // first template the DM adds.
  if (n === 0 && (query || tag !== 'all')) {
    setQuery('');
    setTag('all');
  }

  const handleCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleDelete = async (item: CustomMagicItem) => {
    const confirmed = await confirmDialog({
      title: `Delete ${item.name}?`,
      message:
        'The template is removed from your library. Copies you already gave out stay with their owners.',
      confirmLabel: 'Delete magic item',
      tone: 'danger',
    });
    if (!confirmed) return;
    removeThenFocus(item.id, filteredIds, () =>
      deleteItem(campaignCode, item.id)
    );
  };

  const handleClearFilters = () => {
    setQuery('');
    setTag('all');
    searchRef.current?.focus();
  };

  const handleSave = (
    data: Omit<
      CustomMagicItem,
      'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
    >
  ) => {
    if (editing) updateItem(campaignCode, editing.id, data);
    else {
      const id = createItem(campaignCode, data);
      if (n === 0) {
        // The empty state's Create button unmounts with the first entry, so
        // the editor dialog has nothing to return focus to.
        focusWhenPresent(id);
        // An empty library ignores its saved collapse, so open it for the
        // first template instead of hiding what the DM just made.
        if (campaign?.dmDashboardUi?.magicItemLibrarySectionOpen === false) {
          setDmDashboardUi(campaignCode, { magicItemLibrarySectionOpen: true });
        }
      }
    }
    setEditorOpen(false);
    setEditing(null);
  };

  const handleGive = async (
    template: CustomMagicItem,
    recipient: GiveRecipient
  ) => {
    const {
      campaignCode: _campaignCode,
      tags: _tags,
      group: _group,
      sourceItemId: _source,
      ...magicItem
    } = template;
    void _campaignCode;
    void _tags;
    void _group;
    void _source;
    if (recipient.kind === 'npc') {
      const { npc } = recipient;
      updateNPC(campaignCode, npc.id, {
        inventory: [
          ...(npc.inventory ?? []),
          {
            id: `npc-item-${crypto.randomUUID()}`,
            name: template.name,
            quantity: 1,
            description: template.description,
            type: template.category,
            category: 'magic item',
            rarity: template.rarity,
            magicItem,
          },
        ],
      });
    } else {
      await onGiveToPlayer(magicItem, recipient.target);
    }
  };

  return (
    <>
      <Section
        level={2}
        wrapHeading
        heading={n ? `Magic items (${n})` : 'Magic items'}
        collapsed={n ? !sectionOpen : undefined}
        onCollapsedChange={
          n
            ? collapsed =>
                setDmDashboardUi(campaignCode, {
                  magicItemLibrarySectionOpen: !collapsed,
                })
            : undefined
        }
        trailing={
          n ? (
            <Button
              size="sm"
              ref={fallbackRef}
              leftIcon={<Plus size={16} aria-hidden="true" />}
              onClick={handleCreate}
            >
              Create magic item
            </Button>
          ) : undefined
        }
      >
        {n === 0 ? (
          <div className="py-12 text-center">
            <h3 className="type-subheading text-heading">No magic items yet</h3>
            <p className="type-body text-muted mt-2">
              Start from a compendium item or a blank form. Players and NPCs get
              a copy and the template stays here.
            </p>
            <Button className="mt-4" ref={fallbackRef} onClick={handleCreate}>
              Create magic item
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
              <Input
                ref={searchRef}
                size="sm"
                aria-label="Search magic items"
                placeholder="Cloak of protection"
                value={query}
                onChange={event => setQuery(event.target.value)}
                leftIcon={<Search size={16} aria-hidden="true" />}
                clearable
                onClear={() => setQuery('')}
              />
              <SelectField
                value={tag}
                onValueChange={setTag}
                triggerProps={{ 'aria-label': 'Filter by tag', size: 'sm' }}
              >
                <SelectItem value="all">All tags</SelectItem>
                {tags.map(value => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
            {filtered.length === 0 ? (
              <div className="py-8 text-center">
                <p className="type-body text-muted">
                  No magic items match these filters.
                </p>
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
              <ul className="divide-divider divide-y">
                {filtered.map(item => (
                  <MagicItemLibraryRow
                    key={item.id}
                    item={item}
                    giveRef={registerTarget(item.id)}
                    onGive={() => setGivingItem(item)}
                    onEdit={() => {
                      setEditing(item);
                      setEditorOpen(true);
                    }}
                    onDuplicate={() => duplicateItem(campaignCode, item.id)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </Section>

      {/*
        The sync controls own the autosave effect. Create stays reachable (the
        heading's trailing, or the empty state, which never collapses), so the
        controls must mount outside the collapsible. The card renders nothing
        while the client flag is off.
      */}
      {campaign && <MagicItemSyncControls campaign={campaign} />}

      <MagicItemLibraryDialog
        open={editorOpen}
        onOpenChange={open => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
        item={editing}
        onSave={handleSave}
      />
      <GiveMagicItemDialog
        item={givingItem}
        players={players}
        npcs={npcs}
        onGive={handleGive}
        onClose={() => setGivingItem(null)}
      />
    </>
  );
}
