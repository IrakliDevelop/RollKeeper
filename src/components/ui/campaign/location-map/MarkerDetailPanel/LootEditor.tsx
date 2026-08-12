'use client';

import { useEffect, useState } from 'react';
import { Gift, Minus, Plus, Trash2 } from 'lucide-react';
import {
  AllItemsAutocomplete,
  type CompendiumItem,
} from '@/components/ui/campaign/MagicItemLibrary/AllItemsAutocomplete';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import { useNPCStore } from '@/store/npcStore';
import type { InventoryItem, MagicItem } from '@/types/character';
import type { MarkerLootEntry } from '@/types/battlemap';
import type { CampaignPlayerData } from '@/types/campaign';
import type { CampaignNPC } from '@/types/encounter';
import type { CustomMagicItem } from '@/types/magicItemLibrary';
import { convertProcessedItemToFormData } from '@/utils/itemConversion';
import { convertProcessedMagicItemToFormData } from '@/utils/magicItemConversion';
import { deliverMarkerLoot } from '../markerLootDelivery';

// Zustand selectors must return a stable snapshot while the selected store
// data is unchanged. An inline `?? []` creates a new array on every read and
// causes React 19's external-store subscription to rerender indefinitely.
const EMPTY_CUSTOM_ITEMS: CustomMagicItem[] = [];
const EMPTY_NPCS: CampaignNPC[] = [];

function now(): string {
  return new Date().toISOString();
}

function inventoryItem(
  selection: CompendiumItem & { kind: 'mundane' }
): InventoryItem {
  const form = convertProcessedItemToFormData(selection.item);
  const timestamp = now();
  return {
    ...form,
    id: `item-${crypto.randomUUID()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function magicItem(selection: CompendiumItem & { kind: 'magic' }): MagicItem {
  const form = convertProcessedMagicItemToFormData(selection.item);
  const timestamp = now();
  return {
    ...form,
    id: `magic-${crypto.randomUUID()}`,
    charges: form.charges?.map(charge => ({
      ...charge,
      id: charge.id ?? `charge-${crypto.randomUUID()}`,
    })),
    chargePool: form.chargePool
      ? {
          ...form.chargePool,
          abilities: form.chargePool.abilities.map(ability => ({
            ...ability,
            id: ability.id ?? `ability-${crypto.randomUUID()}`,
          })),
        }
      : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function entry(
  itemKind: MarkerLootEntry['itemKind'],
  item: InventoryItem | MagicItem
): MarkerLootEntry {
  return {
    id: `loot-${crypto.randomUUID()}`,
    itemKind,
    item: structuredClone(item),
    quantity: 1,
    claimedQuantity: 0,
  };
}

export function LootEditor({
  campaignCode,
  dmId,
  value,
  onChange,
  onDelivered,
}: {
  campaignCode: string;
  dmId?: string;
  value: MarkerLootEntry[];
  onChange: (next: MarkerLootEntry[]) => void;
  onDelivered: (next: MarkerLootEntry[]) => void;
}) {
  const mundane = useItemsData();
  const magic = useMagicItemsData();
  const custom = useMagicItemLibraryStore(
    state => state.itemsByCampaign[campaignCode] ?? EMPTY_CUSTOM_ITEMS
  );
  const npcs = useNPCStore(
    state => state.npcsByCampaign[campaignCode] ?? EMPTY_NPCS
  );
  const updateNPC = useNPCStore(state => state.updateNPC);
  const [manualName, setManualName] = useState('');
  const [players, setPlayers] = useState<CampaignPlayerData[]>([]);
  const [recipients, setRecipients] = useState<Record<string, string>>({});
  const [givingId, setGivingId] = useState<string | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/campaign/${campaignCode}/players`)
      .then(response => (response.ok ? response.json() : { players: [] }))
      .then(data => {
        if (active) setPlayers(data.players ?? []);
      })
      .catch(() => {
        if (active) setPlayers([]);
      });
    return () => {
      active = false;
    };
  }, [campaignCode]);

  const addCompendium = (selection: CompendiumItem) => {
    onChange([
      ...value,
      selection.kind === 'magic'
        ? entry('magic', magicItem(selection))
        : entry('inventory', inventoryItem(selection)),
    ]);
  };

  const setQuantity = (id: string, quantity: number) =>
    onChange(
      value.map(item =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(
                item.claimedQuantity || 1,
                Math.min(9999, quantity)
              ),
            }
          : item
      )
    );

  const giveOne = async (loot: MarkerLootEntry) => {
    const recipient = recipients[loot.id];
    if (!recipient || !dmId) return;
    setGivingId(loot.id);
    setDeliveryMessage(null);
    try {
      await deliverMarkerLoot({
        campaignCode,
        dmId,
        entry: loot,
        recipient: recipient.startsWith('npc:')
          ? { kind: 'npc', npcId: recipient.slice(4) }
          : { kind: 'player', playerId: recipient.slice(7) },
        findNpc: id => npcs.find(npc => npc.id === id),
        updateNpc: (id, inventory) =>
          updateNPC(campaignCode, id, { inventory }),
      });
      const next = value.map(item =>
        item.id === loot.id
          ? { ...item, claimedQuantity: item.claimedQuantity + 1 }
          : item
      );
      onDelivered(next);
      setDeliveryMessage(`${loot.item.name} was delivered.`);
    } catch (error) {
      setDeliveryMessage(
        error instanceof Error ? error.message : 'Could not deliver the item.'
      );
    } finally {
      setGivingId(null);
    }
  };

  return (
    <section
      className="border-divider bg-surface-secondary space-y-3 rounded-md border p-3"
      aria-labelledby="marker-loot-heading"
    >
      <h4
        id="marker-loot-heading"
        className="text-heading text-sm font-semibold"
      >
        Loot contents
      </h4>
      {deliveryMessage && (
        <p role="status" className="text-muted text-sm">
          {deliveryMessage}
        </p>
      )}
      <AllItemsAutocomplete
        mundaneItems={mundane.items}
        magicItems={magic.items}
        loading={mundane.loading || magic.loading}
        onSelect={addCompendium}
      />
      {custom.length > 0 && (
        <label className="text-body flex flex-col gap-1 text-sm font-medium">
          Add from campaign item library
          <select
            className="border-divider bg-surface text-body min-h-10 rounded-md border px-3"
            defaultValue=""
            onChange={event => {
              const selected = custom.find(
                item => item.id === event.target.value
              );
              if (selected) {
                const {
                  campaignCode: _campaign,
                  tags: _tags,
                  group: _group,
                  sourceItemId: _source,
                  ...copy
                } = selected;
                void _campaign;
                void _tags;
                void _group;
                void _source;
                onChange([...value, entry('magic', copy)]);
                event.target.value = '';
              }
            }}
          >
            <option value="">Choose an item…</option>
            {custom.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <Input
          label="Manual treasure"
          value={manualName}
          onChange={event => setManualName(event.target.value)}
          placeholder="250 gp, ruby, sealed letter…"
        />
        <Button
          variant="secondary"
          className="self-end"
          leftIcon={<Plus size={16} />}
          onClick={() => {
            const name = manualName.trim();
            if (!name) return;
            const timestamp = now();
            onChange([
              ...value,
              entry('inventory', {
                id: `item-${crypto.randomUUID()}`,
                name,
                category: 'treasure',
                quantity: 1,
                tags: [],
                createdAt: timestamp,
                updatedAt: timestamp,
              }),
            ]);
            setManualName('');
          }}
        >
          Add
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-muted text-sm">No loot added yet.</p>
      ) : (
        <ul className="space-y-2">
          {value.map(loot => {
            const remaining = loot.quantity - loot.claimedQuantity;
            return (
              <li
                key={loot.id}
                className="border-divider bg-surface space-y-2 rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-heading truncate text-sm font-medium">
                      {loot.item.name}
                    </p>
                    <p className="text-muted text-xs">
                      {remaining} of {loot.quantity} available
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Decrease ${loot.item.name} quantity`}
                    onClick={() => setQuantity(loot.id, loot.quantity - 1)}
                  >
                    <Minus size={15} />
                  </Button>
                  <span className="text-body min-w-6 text-center text-sm">
                    {loot.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Increase ${loot.item.name} quantity`}
                    onClick={() => setQuantity(loot.id, loot.quantity + 1)}
                  >
                    <Plus size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${loot.item.name}`}
                    onClick={() =>
                      onChange(value.filter(item => item.id !== loot.id))
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <select
                    aria-label={`Recipient for ${loot.item.name}`}
                    className="border-divider bg-surface text-body min-h-9 min-w-0 flex-1 rounded-md border px-2 text-sm"
                    value={recipients[loot.id] ?? ''}
                    onChange={event =>
                      setRecipients(current => ({
                        ...current,
                        [loot.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Give one to…</option>
                    {players.map(player => (
                      <option
                        key={player.playerId}
                        value={`player:${player.playerId}`}
                      >
                        {player.characterName} (player)
                      </option>
                    ))}
                    {npcs.map(npc => (
                      <option key={npc.id} value={`npc:${npc.id}`}>
                        {npc.name} (NPC)
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Gift size={15} />}
                    disabled={
                      !dmId ||
                      !recipients[loot.id] ||
                      remaining === 0 ||
                      givingId === loot.id
                    }
                    onClick={() => void giveOne(loot)}
                  >
                    Give
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
