'use client';

import { useMemo, useState } from 'react';
import {
  Copy,
  Edit3,
  Gift,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Badge } from '@/components/ui/layout/badge';
import { Card, CardContent } from '@/components/ui/layout/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { ConfirmationModal } from '@/components/ui/feedback/ConfirmationModal';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import type { MagicItem } from '@/types/character';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import type { SendItemTarget } from '../SendItemDialog';
import { MagicItemLibraryDialog } from './MagicItemLibraryDialog';

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
    state => state.itemsByCampaign[campaignCode] ?? []
  );
  const { createItem, updateItem, deleteItem, duplicateItem } =
    useMagicItemLibraryStore();
  const npcs = useNPCStore(state => state.npcsByCampaign[campaignCode] ?? []);
  const updateNPC = useNPCStore(state => state.updateNPC);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('all');
  const [editing, setEditing] = useState<CustomMagicItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [giving, setGiving] = useState<CustomMagicItem | null>(null);
  const [recipient, setRecipient] = useState('');
  const [deleting, setDeleting] = useState<CustomMagicItem | null>(null);
  const [isGiving, setIsGiving] = useState(false);

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

  const handleSave = (
    data: Omit<
      CustomMagicItem,
      'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
    >
  ) => {
    if (editing) updateItem(campaignCode, editing.id, data);
    else createItem(campaignCode, data);
    setEditorOpen(false);
    setEditing(null);
  };

  const handleGive = async () => {
    if (!giving || !recipient) return;
    const {
      campaignCode: _campaignCode,
      tags: _tags,
      group: _group,
      sourceItemId: _source,
      ...magicItem
    } = giving;
    void _campaignCode;
    void _tags;
    void _group;
    void _source;
    setIsGiving(true);
    if (recipient.startsWith('npc:')) {
      const npc = npcs.find(entry => entry.id === recipient.slice(4));
      if (npc) {
        updateNPC(campaignCode, npc.id, {
          inventory: [
            ...(npc.inventory ?? []),
            {
              id: `npc-item-${crypto.randomUUID()}`,
              name: giving.name,
              quantity: 1,
              description: giving.description,
              type: giving.category,
              category: 'magic item',
              rarity: giving.rarity,
              magicItem,
            },
          ],
        });
      }
    } else {
      const player = players.find(
        entry => entry.playerId === recipient.slice(7)
      );
      if (player) await onGiveToPlayer(magicItem, player);
    }
    setIsGiving(false);
    setGiving(null);
    setRecipient('');
  };

  return (
    <section
      className="border-divider mt-8 border-t pt-6"
      aria-labelledby="magic-item-library-heading"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3
            id="magic-item-library-heading"
            className="text-heading flex items-center gap-2 text-lg font-semibold"
          >
            <Sparkles size={20} className="text-accent-purple-text" /> Magic
            Item Library ({items.length})
          </h3>
          <p className="text-muted text-sm">
            Reusable campaign templates stay here after you give out a copy.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={16} />}
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          Create Magic Item
        </Button>
      </div>

      {items.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
          <Input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search name, group, rarity, or tag…"
            leftIcon={<Search size={15} />}
            clearable
            onClear={() => setQuery('')}
          />
          <SelectField value={tag} onValueChange={setTag}>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map(value => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectField>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border-divider bg-surface-secondary rounded-lg border-2 border-dashed p-8 text-center">
          <Sparkles size={36} className="text-faint mx-auto mb-2" />
          <p className="text-muted text-sm">
            No custom magic items yet. Start from any compendium item or a blank
            form.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted py-8 text-center text-sm">
          No items match these filters.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map(item => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-heading font-semibold">{item.name}</h4>
                    <p className="text-muted text-xs">
                      {item.group || 'Ungrouped'}
                    </p>
                  </div>
                  <Badge variant="primary" size="sm">
                    {item.rarity}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.tags.map(value => (
                    <Badge key={value} variant="neutral" size="sm">
                      {value}
                    </Badge>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    variant="secondary"
                    size="xs"
                    leftIcon={<Gift size={13} />}
                    onClick={() => setGiving(item)}
                  >
                    Give copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => {
                      setEditing(item);
                      setEditorOpen(true);
                    }}
                  >
                    <Edit3 size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Duplicate ${item.name}`}
                    onClick={() => duplicateItem(campaignCode, item.id)}
                  >
                    <Copy size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    aria-label={`Delete ${item.name}`}
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <MagicItemLibraryDialog
        open={editorOpen}
        onOpenChange={open => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
        item={editing}
        onSave={handleSave}
      />
      <Dialog
        open={!!giving}
        onOpenChange={open => {
          if (!open) setGiving(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Give {giving?.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <p className="text-muted text-sm">
              Choose a player or NPC. The library template will remain
              unchanged.
            </p>
            <SelectField value={recipient} onValueChange={setRecipient}>
              {players.map(player => (
                <SelectItem
                  key={`player:${player.playerId}`}
                  value={`player:${player.playerId}`}
                >
                  {player.characterName} (player)
                </SelectItem>
              ))}
              {npcs.map(npc => (
                <SelectItem key={`npc:${npc.id}`} value={`npc:${npc.id}`}>
                  {npc.name} (NPC)
                </SelectItem>
              ))}
            </SelectField>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGiving(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<UserRound size={14} />}
              disabled={!recipient}
              loading={isGiving}
              onClick={handleGive}
            >
              Give copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteItem(campaignCode, deleting.id);
        }}
        title="Delete magic item template?"
        message={`Delete ${deleting?.name ?? 'this item'} from the DM library? Copies already given to players or NPCs will not be affected.`}
        confirmText="Delete template"
      />
    </section>
  );
}
