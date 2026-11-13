'use client';

import { useEffect, useState } from 'react';
import { Gift, Lock, Minus, Plus, Trash2 } from 'lucide-react';
import {
  AllItemsAutocomplete,
  type CompendiumItem,
} from '@/components/ui/campaign/MagicItemLibrary/AllItemsAutocomplete';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Section } from '@/components/ui/layout/section';
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

// Radix Select forbids an empty-string item value, so both pickers use a
// disabled placeholder item as their resting value. The add-picker stays on
// it after every pick, so choosing the same item again adds another copy.
const LIBRARY_PLACEHOLDER = '__placeholder__';
const NO_RECIPIENT = '__none__';

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
  access,
  onAccessChange,
}: {
  campaignCode: string;
  dmId?: string;
  value: MarkerLootEntry[];
  onChange: (next: MarkerLootEntry[]) => void;
  onDelivered: (next: MarkerLootEntry[]) => void;
  access: 'locked' | 'open';
  onAccessChange: (next: 'locked' | 'open') => void;
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

  const addFromLibrary = (itemId: string) => {
    if (itemId === LIBRARY_PLACEHOLDER) return;
    const selected = custom.find(item => item.id === itemId);
    if (!selected) return;
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
  };

  return (
    <Section heading="Loot contents" level={4} contentClassName="space-y-3">
      <div className="flex flex-col gap-1.5">
        <span className="type-small text-muted">Player access</span>
        <div role="group" aria-label="Player access" className="flex gap-1">
          <Button
            variant="secondary"
            selected={access === 'locked'}
            size="sm"
            aria-pressed={access === 'locked'}
            leftIcon={<Lock size={14} />}
            onClick={() => onAccessChange('locked')}
          >
            Locked
          </Button>
          <Button
            variant="secondary"
            selected={access === 'open'}
            size="sm"
            aria-pressed={access === 'open'}
            onClick={() => onAccessChange('open')}
          >
            Open
          </Button>
        </div>
        <p className="type-small text-body">
          {access === 'locked'
            ? 'Players see a locked chest and nothing inside. Claims are refused on the server too.'
            : "Players can see the contents and claim up to what's left."}
        </p>
      </div>
      {deliveryMessage && (
        <p role="status" className="type-small text-muted">
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
        <SelectField
          label="Add from campaign item library"
          value={LIBRARY_PLACEHOLDER}
          onValueChange={addFromLibrary}
        >
          <SelectItem value={LIBRARY_PLACEHOLDER} disabled>
            Choose an item…
          </SelectItem>
          {custom.map(item => (
            <SelectItem key={item.id} value={item.id}>
              {item.name}
            </SelectItem>
          ))}
        </SelectField>
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
          size="md"
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
        <p className="type-small text-muted">No loot added yet.</p>
      ) : (
        <ul className="divide-divider divide-y">
          {value.map(loot => {
            const remaining = loot.quantity - loot.claimedQuantity;
            return (
              <li key={loot.id} className="space-y-2 py-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="type-ui text-heading truncate">
                      {loot.item.name}
                    </p>
                    <p className="type-small text-muted">
                      {remaining} of {loot.quantity} available
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-9 shrink-0 px-0"
                    aria-label={`Decrease ${loot.item.name} quantity`}
                    onClick={() => setQuantity(loot.id, loot.quantity - 1)}
                  >
                    <Minus size={16} />
                  </Button>
                  <span className="type-ui text-body min-w-6 text-center tabular-nums">
                    {loot.quantity}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-9 shrink-0 px-0"
                    aria-label={`Increase ${loot.item.name} quantity`}
                    onClick={() => setQuantity(loot.id, loot.quantity + 1)}
                  >
                    <Plus size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-9 shrink-0 px-0"
                    aria-label={`Remove ${loot.item.name}`}
                    onClick={() =>
                      onChange(value.filter(item => item.id !== loot.id))
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <SelectField
                    value={recipients[loot.id] ?? NO_RECIPIENT}
                    onValueChange={recipient => {
                      if (recipient === NO_RECIPIENT) return;
                      setRecipients(current => ({
                        ...current,
                        [loot.id]: recipient,
                      }));
                    }}
                    wrapperClassName="min-w-0 flex-1"
                    triggerProps={{
                      'aria-label': `Recipient for ${loot.item.name}`,
                      size: 'sm',
                    }}
                  >
                    <SelectItem value={NO_RECIPIENT} disabled>
                      Give one to…
                    </SelectItem>
                    {players.map(player => (
                      <SelectItem
                        key={player.playerId}
                        value={`player:${player.playerId}`}
                      >
                        {player.characterName} (player)
                      </SelectItem>
                    ))}
                    {npcs.map(npc => (
                      <SelectItem key={npc.id} value={`npc:${npc.id}`}>
                        {npc.name} (NPC)
                      </SelectItem>
                    ))}
                  </SelectField>
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
    </Section>
  );
}
