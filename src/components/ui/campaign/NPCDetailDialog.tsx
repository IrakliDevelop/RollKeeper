'use client';

import React, { useRef, useState } from 'react';
import {
  Edit3,
  Trash2,
  Heart,
  Shield,
  Footprints,
  BookOpen,
  ScrollText,
  X,
  Package,
  Plus,
  Minus,
  Scale,
  Coins,
  Pencil,
  Send,
  Wand2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { MonsterStatBlockPanel } from '@/components/ui/encounter/MonsterStatBlockPanel';
import { NPCStatBlockExport } from './NPCStatBlockExport';
import {
  ItemForm,
  initialInventoryFormData,
} from '@/components/ui/game/inventory/ItemForm';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import type { CampaignNPC, NPCInventoryItem } from '@/types/encounter';
import { formatCurrencyFromCopper } from '@/utils/currency';
import {
  npcInventoryItemToFormData,
  formDataToNpcInventoryPatch,
} from '@/utils/npcInventoryItemForm';
import { NPCSpellTab } from './NPCSpellTab';

type DetailTab = 'stats' | 'spells' | 'inventory' | 'lore';

interface NPCDetailDialogProps {
  npc: CampaignNPC | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (npc: CampaignNPC) => void;
  onDelete?: (npc: CampaignNPC) => void;
  onUpdateInventory?: (npcId: string, inventory: NPCInventoryItem[]) => void;
  onSendItemToPlayer?: (item: NPCInventoryItem, npcName: string) => void;
  initialTab?: DetailTab;
  readOnly?: boolean;
  encounterId?: string;
  npcEntityId?: string;
}

const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

function AbilityScoreGrid({
  scores,
}: {
  scores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
}) {
  return (
    <div className="grid grid-cols-6 gap-2 text-center">
      {ABILITY_KEYS.map((key, i) => {
        const mod = Math.floor((scores[key] - 10) / 2);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        return (
          <div
            key={key}
            className="bg-surface-secondary rounded-lg px-2 py-1.5"
          >
            <span className="text-muted block text-[10px] font-bold tracking-wide uppercase">
              {ABILITY_LABELS[i]}
            </span>
            <span className="text-heading block text-sm font-semibold">
              {scores[key]}
            </span>
            <span className="text-muted block text-xs">({modStr})</span>
          </div>
        );
      })}
    </div>
  );
}

function ExtraStatsBadges({ npc }: { npc: CampaignNPC }) {
  const hasExtras =
    npc.proficiencyBonus !== undefined ||
    npc.hitDice !== undefined ||
    npc.passivePerception !== undefined ||
    npc.passiveInsight !== undefined ||
    npc.passiveInvestigation !== undefined;

  if (!hasExtras) return null;

  const passiveParts: string[] = [];
  if (npc.passivePerception !== undefined)
    passiveParts.push(`PP ${npc.passivePerception}`);
  if (npc.passiveInsight !== undefined)
    passiveParts.push(`PI ${npc.passiveInsight}`);
  if (npc.passiveInvestigation !== undefined)
    passiveParts.push(`PIv ${npc.passiveInvestigation}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {npc.proficiencyBonus !== undefined && (
        <span className="bg-surface-secondary text-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          PB{' '}
          <span className="text-heading font-semibold">
            {npc.proficiencyBonus >= 0
              ? `+${npc.proficiencyBonus}`
              : `${npc.proficiencyBonus}`}
          </span>
        </span>
      )}
      {npc.hitDice !== undefined && (
        <span className="bg-surface-secondary text-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          HD{' '}
          <span className="text-heading font-semibold">
            {npc.hitDice.current}/{npc.hitDice.max} {npc.hitDice.dieType}
          </span>
        </span>
      )}
      {passiveParts.length > 0 && (
        <span className="bg-surface-secondary text-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
          <span className="text-heading font-semibold">
            {passiveParts.join(' · ')}
          </span>
        </span>
      )}
    </div>
  );
}

const RARITY_VARIANTS: Record<
  string,
  'neutral' | 'info' | 'success' | 'warning' | 'danger'
> = {
  common: 'neutral',
  uncommon: 'success',
  rare: 'info',
  'very rare': 'warning',
  legendary: 'danger',
  artifact: 'danger',
};

const CATEGORY_ICON: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  tool: '🔧',
  misc: '📦',
  magic: '✨',
  consumable: '🧪',
  treasure: '💎',
};

const RARITY_BORDER: Record<string, string> = {
  common: 'border-divider',
  uncommon: 'border-accent-emerald-border',
  rare: 'border-accent-blue-border',
  'very rare': 'border-accent-purple-border',
  legendary: 'border-accent-amber-border',
  artifact: 'border-accent-red-border',
};

function InventoryItemCard({
  item,
  onRemove,
  onClick,
  onEdit,
  onQuantityChange,
  onSend,
}: {
  item: NPCInventoryItem;
  onRemove?: () => void;
  onClick?: () => void;
  onEdit?: () => void;
  onQuantityChange?: (quantity: number) => void;
  onSend?: () => void;
}) {
  const borderClass =
    (item.rarity && RARITY_BORDER[item.rarity]) || 'border-divider';
  const icon = (item.category && CATEGORY_ICON[item.category]) || '📦';

  return (
    <div
      className={`bg-surface-raised flex overflow-hidden rounded-lg border-2 ${borderClass} ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      {/* Full-height icon strip */}
      <div className="bg-surface-secondary border-divider flex w-9 shrink-0 items-center justify-center self-stretch border-r-2 text-base">
        {icon}
      </div>
      {/* Content */}
      <div className="min-w-0 flex-1 px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <span
            className="text-heading truncate text-xs font-bold"
            title={item.name}
          >
            {item.name}
          </span>
          <div
            className="flex shrink-0 items-center gap-0.5"
            onClick={e => e.stopPropagation()}
          >
            {onSend && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onSend();
                }}
                className="text-accent-amber-text-muted hover:bg-accent-amber-bg hover:text-accent-amber-text rounded p-0.5 transition-colors"
                title="Send to player"
              >
                <Send size={12} />
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="text-muted hover:text-accent-blue-text p-0.5 transition-colors"
                title="Edit item"
              >
                <Pencil size={12} />
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="text-muted hover:text-accent-red-text p-0.5 transition-colors"
                title="Remove"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
        {/* Meta badges + quantity controls */}
        <div
          className="mt-0.5 flex flex-wrap items-center gap-1"
          onClick={e => e.stopPropagation()}
        >
          {onQuantityChange ? (
            <span className="bg-surface-secondary inline-flex items-center gap-0.5 rounded px-0.5 text-[10px] font-medium">
              <button
                onClick={() => onQuantityChange(Math.max(0, item.quantity - 1))}
                className="text-muted hover:text-accent-red-text rounded p-0.5 transition-colors disabled:opacity-30"
                disabled={item.quantity <= 0}
                title="Decrease"
              >
                <Minus size={10} />
              </button>
              <span className="text-heading min-w-[1rem] text-center font-bold">
                {item.quantity}
              </span>
              <button
                onClick={() => onQuantityChange(item.quantity + 1)}
                className="text-muted hover:text-accent-emerald-text rounded p-0.5 transition-colors"
                title="Increase"
              >
                <Plus size={10} />
              </button>
            </span>
          ) : item.quantity > 1 ? (
            <span className="bg-surface-secondary text-muted rounded px-1 text-[10px] font-medium">
              ×{item.quantity}
            </span>
          ) : null}
          {item.rarity && item.rarity !== 'none' && (
            <Badge
              variant={RARITY_VARIANTS[item.rarity] || 'neutral'}
              size="sm"
            >
              {item.rarity}
            </Badge>
          )}
          {item.equipped && (
            <Badge variant="success" size="sm">
              Eq
            </Badge>
          )}
          {item.weight !== undefined && (
            <span className="text-faint text-[10px]">{item.weight}lb</span>
          )}
          {item.value !== undefined && (
            <span className="text-faint text-[10px]">
              {formatCurrencyFromCopper(item.value)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function NPCItemViewModal({
  item,
  onClose,
  onEdit,
}: {
  item: NPCInventoryItem | null;
  onClose: () => void;
  onEdit?: () => void;
}) {
  if (!item) return null;

  const totalWeight = item.weight
    ? parseFloat((item.weight * item.quantity).toFixed(2))
    : undefined;
  const totalValue = item.value
    ? parseFloat((item.value * item.quantity).toFixed(2))
    : undefined;

  return (
    <Dialog open={!!item} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            {item.name}
            {item.equipped && (
              <Badge variant="success" size="sm">
                Equipped
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Rarity and Type */}
          {(item.rarity || item.type) && (
            <div className="flex flex-wrap gap-2">
              {item.rarity && (
                <Badge
                  variant={RARITY_VARIANTS[item.rarity] || 'neutral'}
                  size="md"
                >
                  {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                </Badge>
              )}
              {item.type && (
                <Badge variant="info" size="md">
                  {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                </Badge>
              )}
            </div>
          )}

          {/* Details Grid */}
          <div className="bg-surface-secondary rounded-lg p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {item.category && (
                <div>
                  <span className="text-muted text-xs font-medium uppercase">
                    Category
                  </span>
                  <p className="text-heading mt-0.5 font-medium capitalize">
                    {item.category}
                  </p>
                </div>
              )}

              <div>
                <span className="text-muted text-xs font-medium uppercase">
                  Quantity
                </span>
                <p className="text-heading mt-0.5 font-bold">{item.quantity}</p>
              </div>

              {item.weight !== undefined && (
                <div>
                  <span className="text-muted text-xs font-medium uppercase">
                    Weight
                  </span>
                  <p className="text-heading mt-0.5 flex items-center gap-1 font-medium">
                    <Scale className="h-3 w-3" />
                    {item.weight} lbs each
                    {item.quantity > 1 && totalWeight !== undefined && (
                      <span className="text-muted">
                        ({totalWeight} lbs total)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {item.value !== undefined && (
                <div>
                  <span className="text-muted text-xs font-medium uppercase">
                    Value
                  </span>
                  <p className="text-heading mt-0.5 flex items-center gap-1 font-medium">
                    <Coins className="h-3 w-3" />
                    {formatCurrencyFromCopper(item.value)} each
                    {item.quantity > 1 && totalValue !== undefined && (
                      <span className="text-muted">
                        ({formatCurrencyFromCopper(totalValue)} total)
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div>
              <h4 className="text-heading mb-1.5 text-sm font-semibold">
                Description
              </h4>
              <div
                className="prose prose-sm text-body max-w-none leading-relaxed"
                dangerouslySetInnerHTML={{ __html: item.description }}
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {onEdit && (
            <Button onClick={onEdit} variant="primary" size="sm">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          <Button onClick={onClose} variant="ghost" size="sm">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NPCDetailDialog({
  npc,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onUpdateInventory,
  onSendItemToPlayer,
  initialTab,
  readOnly,
  encounterId,
  npcEntityId,
}: NPCDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('stats');
  const [showFullImage, setShowFullImage] = useState(false);
  const [inventoryFormOpen, setInventoryFormOpen] = useState(false);
  const [inventoryFormEditingItem, setInventoryFormEditingItem] =
    useState<NPCInventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<NPCInventoryItem | null>(null);
  const addSpellRef = useRef<(() => void) | null>(null);

  const { items: dbItems, loading: dbItemsLoading } = useItemsData();
  const { items: dbMagicItems } = useMagicItemsData();

  React.useEffect(() => {
    if (!open) {
      setShowFullImage(false);
      setInventoryFormOpen(false);
      setInventoryFormEditingItem(null);
      setViewingItem(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const handleInventoryFormSubmit = (data: InventoryFormData) => {
    if (!npc || !onUpdateInventory) return;
    if (inventoryFormEditingItem) {
      const updated = (npc.inventory ?? []).map(i =>
        i.id === inventoryFormEditingItem.id
          ? formDataToNpcInventoryPatch(data, i)
          : i
      );
      onUpdateInventory(npc.id, updated);
    } else {
      const newItem: NPCInventoryItem = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: data.name,
        quantity: data.quantity,
        category: data.category,
        weight: data.weight,
        value: data.value,
        rarity: data.rarity,
        description: data.description || undefined,
        type: data.type,
      };
      onUpdateInventory(npc.id, [...(npc.inventory ?? []), newItem]);
    }
    setInventoryFormOpen(false);
    setInventoryFormEditingItem(null);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!npc || !onUpdateInventory) return;
    const updated = (npc.inventory ?? []).filter(i => i.id !== itemId);
    onUpdateInventory(npc.id, updated);
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    if (!npc || !onUpdateInventory) return;
    const updated = (npc.inventory ?? []).map(i =>
      i.id === itemId ? { ...i, quantity } : i
    );
    onUpdateInventory(npc.id, updated);
  };

  if (!npc) return null;

  const statBlock = npc.monsterStatBlock;
  const typeInfo = statBlock
    ? `${statBlock.size} ${statBlock.type}${statBlock.cr ? ` — CR ${statBlock.cr}` : ''}`
    : null;

  const tabs: Array<{ key: DetailTab; icon: React.ReactNode; label: string }> =
    [
      {
        key: 'stats',
        icon: <ScrollText className="h-3.5 w-3.5" />,
        label: 'Stat Block',
      },
      ...(npc.spellcasting
        ? [
            {
              key: 'spells' as DetailTab,
              icon: <Wand2 className="h-3.5 w-3.5" />,
              label: 'Spells',
            },
          ]
        : []),
      {
        key: 'inventory',
        icon: <Package className="h-3.5 w-3.5" />,
        label: 'Inventory',
      },
      {
        key: 'lore',
        icon: <BookOpen className="h-3.5 w-3.5" />,
        label: 'Lore',
      },
    ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[85vh] sm:max-w-4xl">
        <DialogHeader>
          <div className="flex items-start gap-4 pr-16">
            {npc.avatarUrl && (
              <button
                type="button"
                onClick={() => setShowFullImage(true)}
                className="group relative shrink-0"
                title="Click to view full image"
              >
                <img
                  src={npc.avatarUrl}
                  alt={npc.name}
                  className="border-divider h-14 w-14 rounded-full border-2 object-cover transition-opacity group-hover:opacity-80"
                />
                <span className="bg-surface/80 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
                  <svg
                    className="text-heading h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </span>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-heading text-xl font-bold">
                {npc.name}
              </DialogTitle>
              {npc.description && (
                <p className="text-muted mt-0.5 text-sm">{npc.description}</p>
              )}
              {typeInfo && (
                <p className="text-faint mt-0.5 text-xs italic">{typeInfo}</p>
              )}
            </div>
            {!readOnly && onEdit && onDelete && (
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onEdit(npc);
                    onOpenChange(false);
                  }}
                  aria-label="Edit NPC"
                >
                  <Edit3 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(npc)}
                  aria-label="Delete NPC"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Tab bar */}
        <div className="bg-surface-secondary flex rounded-lg p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-surface-raised text-heading shadow-sm'
                  : 'text-muted hover:text-body'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <DialogBody className="min-h-0 overflow-y-auto">
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {statBlock ? (
                <>
                  <MonsterStatBlockPanel statBlock={statBlock} />
                  <ExtraStatsBadges npc={npc} />
                </>
              ) : (
                <>
                  {/* Basic stats row */}
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2">
                      <Heart className="text-accent-red-text h-4 w-4" />
                      <span className="text-muted text-xs">HP</span>
                      <span className="text-heading text-sm font-semibold">
                        {npc.maxHp}
                      </span>
                    </div>
                    <div className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2">
                      <Shield className="text-accent-blue-text h-4 w-4" />
                      <span className="text-muted text-xs">AC</span>
                      <span className="text-heading text-sm font-semibold">
                        {npc.armorClass}
                      </span>
                    </div>
                    <div className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2">
                      <Footprints className="text-accent-amber-text h-4 w-4" />
                      <span className="text-muted text-xs">Speed</span>
                      <span className="text-heading text-sm font-semibold">
                        {npc.speed}
                      </span>
                    </div>
                  </div>

                  <ExtraStatsBadges npc={npc} />

                  {npc.abilityScores && (
                    <AbilityScoreGrid scores={npc.abilityScores} />
                  )}

                  {npc.description && !npc.abilityScores && (
                    <p className="text-body text-sm">{npc.description}</p>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'spells' && npc.spellcasting && (
            <NPCSpellTab
              npc={npc}
              campaignCode={npc.campaignCode}
              addSpellRef={addSpellRef}
              encounterId={encounterId}
              npcEntityId={npcEntityId}
            />
          )}

          {activeTab === 'inventory' &&
            (npc.inventory && npc.inventory.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {npc.inventory.map(item => (
                  <InventoryItemCard
                    key={item.id}
                    item={item}
                    onClick={() => setViewingItem(item)}
                    onEdit={
                      onUpdateInventory
                        ? () => {
                            setInventoryFormEditingItem(item);
                            setInventoryFormOpen(true);
                          }
                        : undefined
                    }
                    onRemove={
                      onUpdateInventory
                        ? () => handleRemoveItem(item.id)
                        : undefined
                    }
                    onQuantityChange={
                      onUpdateInventory
                        ? qty => handleQuantityChange(item.id, qty)
                        : undefined
                    }
                    onSend={
                      onSendItemToPlayer
                        ? () => onSendItemToPlayer(item, npc.name)
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <Package className="text-faint mx-auto mb-3 h-10 w-10" />
                  <p className="text-muted text-sm">No inventory items</p>
                </div>
              </div>
            ))}

          {activeTab === 'lore' &&
            (npc.loreHtml ? (
              <div
                className="prose prose-sm text-body max-w-none"
                dangerouslySetInnerHTML={{ __html: npc.loreHtml }}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <BookOpen className="text-faint mx-auto mb-3 h-10 w-10" />
                  <p className="text-muted text-sm">No lore written yet</p>
                  {onEdit && !readOnly && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        onEdit(npc);
                        onOpenChange(false);
                      }}
                    >
                      Edit to add lore
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </DialogBody>

        <DialogFooter className="!flex-col !items-start gap-2">
          {activeTab === 'inventory' && onUpdateInventory && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setInventoryFormEditingItem(null);
                setInventoryFormOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Item
            </Button>
          )}
          {activeTab === 'spells' && npc.spellcasting && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addSpellRef.current?.()}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Spell
            </Button>
          )}
          <div className="flex w-full justify-between">
            <div className="flex gap-2">
              {statBlock && <NPCStatBlockExport npc={npc} />}
            </div>
            {!readOnly && onEdit && onDelete && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    onEdit(npc);
                    onOpenChange(false);
                  }}
                >
                  <Edit3 className="mr-1.5 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="danger" onClick={() => onDelete(npc)}>
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {showFullImage && npc.avatarUrl && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            type="button"
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close image"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={npc.avatarUrl}
            alt={npc.name}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-center text-sm text-white/60">
            Right-click image to copy or save
          </p>
        </div>
      )}

      {/* Stacked Item View modal */}
      <NPCItemViewModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onEdit={
          onUpdateInventory && viewingItem
            ? () => {
                const v = viewingItem;
                setViewingItem(null);
                setInventoryFormEditingItem(v);
                setInventoryFormOpen(true);
              }
            : undefined
        }
      />

      <ItemForm
        isOpen={inventoryFormOpen}
        onClose={() => {
          setInventoryFormOpen(false);
          setInventoryFormEditingItem(null);
        }}
        onSubmit={handleInventoryFormSubmit}
        initialData={
          inventoryFormEditingItem
            ? npcInventoryItemToFormData(inventoryFormEditingItem)
            : initialInventoryFormData
        }
        availableLocations={[]}
        isEditing={!!inventoryFormEditingItem}
        databaseItems={dbItems}
        databaseMagicItems={dbMagicItems}
        itemsLoading={dbItemsLoading}
      />
    </Dialog>
  );
}
