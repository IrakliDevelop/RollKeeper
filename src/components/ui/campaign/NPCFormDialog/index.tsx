'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Search,
  X,
  Plus,
  Trash2,
  Edit3,
  ImageIcon,
  CircleUserRound,
  ScrollText,
  Package,
  Wand2,
  BookOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput, NumberField } from '@/components/ui/forms/NumberInput';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
import { Badge } from '@/components/ui/layout/badge';
import { CampaignNPC } from '@/types/encounter';
import { ProcessedMonster, CREATURE_TYPES, SIZES } from '@/types/bestiary';
import { ProcessedItem } from '@/types/items';
import { ItemAutocomplete } from '@/components/ui/forms/ItemAutocomplete';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { formatCurrencyFromCopper } from '@/utils/currency';
import {
  ItemForm,
  initialInventoryFormData,
} from '@/components/ui/game/inventory/ItemForm';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';
import { npcInventoryItemToFormData } from '@/utils/npcInventoryItemForm';
import { StatBlockTab } from './StatBlockTab';
import { SpellsTab } from './SpellsTab';
import { useNpcFormState } from './useNpcFormState';

interface NPCFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    data: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>
  ) => void;
  editingNpc?: CampaignNPC | null;
  existingGroups?: string[];
  entityLabel?: 'NPC' | 'Custom Monster';
}

type FormTab = 'basic' | 'statblock' | 'inventory' | 'spellcasting' | 'lore';

const FORM_TABS: Array<{ key: FormTab; label: string; icon: React.ReactNode }> =
  [
    {
      key: 'basic',
      label: 'Basic',
      icon: <CircleUserRound className="h-3.5 w-3.5" />,
    },
    {
      key: 'statblock',
      label: 'Stat Block',
      icon: <ScrollText className="h-3.5 w-3.5" />,
    },
    {
      key: 'inventory',
      label: 'Inventory',
      icon: <Package className="h-3.5 w-3.5" />,
    },
    {
      key: 'spellcasting',
      label: 'Spells',
      icon: <Wand2 className="h-3.5 w-3.5" />,
    },
    {
      key: 'lore',
      label: 'Lore',
      icon: <BookOpen className="h-3.5 w-3.5" />,
    },
  ];

export function NPCFormDialog({
  open,
  onOpenChange,
  onSave,
  editingNpc,
  existingGroups = [],
  entityLabel = 'NPC',
}: NPCFormDialogProps) {
  const form = useNpcFormState({ open, editingNpc, onSave, onOpenChange });
  const { draft, derived, update } = form;

  // Item database for inventory autocomplete
  const { items: dbItems, loading: dbItemsLoading } = useItemsData();
  const { items: dbMagicItems } = useMagicItemsData();

  // Active form tab
  const [activeFormTab, setActiveFormTab] = useState<FormTab>('basic');

  // Bestiary search
  const [bestiaryQuery, setBestiaryQuery] = useState('');
  const [bestiaryResults, setBestiaryResults] = useState<ProcessedMonster[]>(
    []
  );
  const [bestiaryLoading, setBestiaryLoading] = useState(false);

  // Portrait
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tags
  const [tagInput, setTagInput] = useState('');

  // Inventory edit form
  const [inventoryEditFormOpen, setInventoryEditFormOpen] = useState(false);
  const [editingInventoryItemId, setEditingInventoryItemId] = useState<
    string | null
  >(null);

  // ---------- Reset on open / editingNpc change ----------

  useEffect(() => {
    if (!open) return;
    setActiveFormTab('basic');
    setTagInput('');
    if (!editingNpc) {
      setBestiaryQuery('');
      setBestiaryResults([]);
    }
  }, [editingNpc, open]);

  // ---------- Tag handling ----------

  const commitTagInput = () => {
    form.addTag(tagInput);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTagInput();
    } else if (
      e.key === 'Backspace' &&
      tagInput === '' &&
      draft.tags.length > 0
    ) {
      form.removeLastTag();
    }
  };

  // ---------- Bestiary Search ----------

  const searchBestiary = useCallback(async (query: string) => {
    if (query.length < 2) {
      setBestiaryResults([]);
      return;
    }
    setBestiaryLoading(true);
    try {
      const res = await fetch(
        `/api/bestiary/search?q=${encodeURIComponent(query)}&limit=10`
      );
      if (res.ok) {
        const data = await res.json();
        setBestiaryResults(data.monsters ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setBestiaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (editingNpc) return;
    const timeout = setTimeout(() => searchBestiary(bestiaryQuery), 300);
    return () => clearTimeout(timeout);
  }, [bestiaryQuery, searchBestiary, editingNpc]);

  const handleSelectMonster = (monster: ProcessedMonster) => {
    form.importMonster(monster);
    setBestiaryQuery('');
    setBestiaryResults([]);
  };

  // ---------- Portrait Upload ----------

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    setUploadingAvatar(true);
    try {
      const npcId = editingNpc?.id ?? `new-npc-${Date.now()}`;
      const formData = new FormData();
      formData.append('file', file);
      formData.append('npcId', npcId);

      const res = await fetch('/api/npc/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();

      if (draft.avatarUrl && draft.avatarUrl.includes('s3.amazonaws.com')) {
        fetch(`/api/npc/delete?url=${encodeURIComponent(draft.avatarUrl)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }

      update({ avatarUrl: url });
    } catch {
      // silently fail
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    if (draft.avatarUrl && draft.avatarUrl.includes('s3.amazonaws.com')) {
      fetch(`/api/npc/delete?url=${encodeURIComponent(draft.avatarUrl)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    update({ avatarUrl: '' });
  };

  // ---------- Save ----------

  const submitLabel = editingNpc ? 'Save Changes' : `Create ${entityLabel}`;

  const editingInventoryItem = editingInventoryItemId
    ? draft.inventoryItems.find(i => i.id === editingInventoryItemId)
    : undefined;

  const handleInventoryEditSubmit = (data: InventoryFormData) => {
    if (!editingInventoryItemId) return;
    form.applyInventoryEdit(editingInventoryItemId, data);
    setInventoryEditFormOpen(false);
    setEditingInventoryItemId(null);
  };

  // ---------- Render ----------

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="h-[85vh] sm:max-w-4xl">
          <DialogHeader className="flex flex-col gap-3 space-y-0 pr-10 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <DialogTitle className="shrink-0">
              {editingNpc ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
            </DialogTitle>
            <div className="flex shrink-0 justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={form.submit}
                disabled={!form.canSubmit}
              >
                {submitLabel}
              </Button>
            </div>
          </DialogHeader>
          {/* Form tabs */}
          <div
            role="tablist"
            className="bg-surface-secondary flex rounded-lg p-1"
          >
            {FORM_TABS.map(tab => (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={activeFormTab === tab.key}
                aria-controls={`npc-form-panel-${tab.key}`}
                onClick={() => setActiveFormTab(tab.key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeFormTab === tab.key
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
            <div className="space-y-5">
              {activeFormTab === 'basic' && (
                <>
                  {/* ===== Bestiary Import (create only) ===== */}
                  {!editingNpc && (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search
                          size={14}
                          className="text-muted absolute top-1/2 left-3 -translate-y-1/2"
                        />
                        <input
                          type="text"
                          value={bestiaryQuery}
                          onChange={e => setBestiaryQuery(e.target.value)}
                          placeholder="Search bestiary to import..."
                          className="bg-surface-secondary text-body border-divider placeholder:text-faint w-full rounded-md border py-2 pr-3 pl-9 text-sm focus:ring-1 focus:ring-(--color-accent-purple-border) focus:outline-none"
                        />
                        {bestiaryLoading && (
                          <span className="text-muted absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                            Searching…
                          </span>
                        )}
                      </div>

                      {bestiaryResults.length > 0 && (
                        <div className="border-divider bg-surface-raised max-h-48 overflow-y-auto rounded-md border">
                          {bestiaryResults.map(m => (
                            <button
                              key={m.id}
                              onClick={() => handleSelectMonster(m)}
                              className="hover:bg-surface-secondary text-body flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors"
                            >
                              <span className="flex-1 font-medium">
                                {m.name}
                              </span>
                              <span className="text-muted text-xs">
                                CR {m.cr}
                              </span>
                              <span className="text-faint text-xs">
                                {typeof m.type === 'string'
                                  ? m.type
                                  : m.type.type}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {draft.bestiarySourceId && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            Imported from: {draft.bestiarySourceName}
                          </Badge>
                          <button
                            onClick={form.clearImport}
                            className="text-muted hover:text-body transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ===== Portrait Upload ===== */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-divider bg-surface-secondary hover:border-accent-purple-border flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 transition-colors"
                    >
                      {draft.avatarUrl ? (
                        <Image
                          src={draft.avatarUrl}
                          alt={`${entityLabel} portrait`}
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={24} className="text-muted" />
                      )}
                      {uploadingAvatar && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        </div>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarSelect}
                      className="hidden"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-muted text-xs">
                        {draft.avatarUrl
                          ? 'Portrait uploaded'
                          : 'Click to upload portrait'}
                      </span>
                      {draft.avatarUrl && (
                        <button
                          onClick={handleRemoveAvatar}
                          className="text-accent-red-text text-xs hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ===== Name & Description ===== */}
                  <div className="space-y-3">
                    <Input
                      value={draft.name}
                      onChange={e => update({ name: e.target.value })}
                      label="Name"
                      placeholder={`${entityLabel} name`}
                      required
                      autoFocus
                    />
                    <Input
                      value={draft.description}
                      onChange={e => update({ description: e.target.value })}
                      label="Description"
                      placeholder="Brief description"
                    />
                  </div>

                  {/* ===== Group & Tags ===== */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-heading mb-1.5 block text-sm font-medium">
                        Group
                      </label>
                      <input
                        type="text"
                        list="npc-groups-datalist"
                        value={draft.group}
                        onChange={e => update({ group: e.target.value })}
                        placeholder="e.g. Bandits, Town Guard"
                        className="bg-surface border-divider text-body placeholder:text-faint w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:ring-(--color-accent-purple-border) focus:outline-none"
                      />
                      {existingGroups.length > 0 && (
                        <datalist id="npc-groups-datalist">
                          {existingGroups.map(g => (
                            <option key={g} value={g} />
                          ))}
                        </datalist>
                      )}
                    </div>

                    <div>
                      <label className="text-heading mb-1.5 block text-sm font-medium">
                        Tags
                      </label>
                      <div className="border-divider bg-surface flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
                        {draft.tags.map(tag => (
                          <span
                            key={tag}
                            className="bg-accent-purple-bg text-accent-purple-text flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => form.removeTag(tag)}
                              className="hover:text-heading transition-colors"
                              aria-label={`Remove tag ${tag}`}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                        <input
                          type="text"
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                          onBlur={() => tagInput.trim() && commitTagInput()}
                          placeholder={
                            draft.tags.length === 0
                              ? 'Add tags (Enter or comma)'
                              : ''
                          }
                          className="text-body placeholder:text-faint min-w-28 flex-1 bg-transparent text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ===== Core Stats ===== */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <SelectField
                        label="Size"
                        value={draft.size}
                        onValueChange={v => update({ size: v })}
                      >
                        {SIZES.map((s: string) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectField>
                      <SelectField
                        label="Type"
                        value={draft.creatureType}
                        onValueChange={v => update({ creatureType: v })}
                      >
                        {CREATURE_TYPES.map((t: string) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectField>
                      <Input
                        value={draft.alignment}
                        onChange={e => update({ alignment: e.target.value })}
                        label="Alignment"
                        placeholder="Unaligned"
                      />
                    </div>
                    <Input
                      value={draft.ac}
                      onChange={e => update({ ac: e.target.value })}
                      label="AC"
                      placeholder="16 (natural armor)"
                      helperText="Free text — the leading number is used in combat."
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInput
                        value={draft.hp}
                        onChange={v => update({ hp: v ?? 1 })}
                        label="HP"
                        min={1}
                      />
                      <Input
                        value={draft.hpFormula}
                        onChange={e => update({ hpFormula: e.target.value })}
                        label="HP Formula"
                        placeholder="2d8+2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <NumberInput
                        value={draft.tempHp}
                        onChange={v => update({ tempHp: v ?? 0 })}
                        label="Temp HP"
                        min={0}
                        placeholder="0"
                        title="Temporary hit points (absorbed before real HP)"
                      />
                      <Input
                        value={draft.tempAc}
                        onChange={e => update({ tempAc: e.target.value })}
                        label="Temp AC"
                        placeholder="2 (shield spell)"
                        title="Temporary AC bonus; leading number is added to AC. Note the source."
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        value={draft.speed}
                        onChange={e => update({ speed: e.target.value })}
                        label="Speed"
                        placeholder="30 ft., fly 60 ft."
                      />
                      <NumberInput
                        value={derived.initiativeModifier}
                        onChange={v => update({ initiativeOverride: v ?? 0 })}
                        label="Init Mod"
                        title="Initiative modifier (auto-calculated from DEX, overridable)"
                      />
                      <NumberInput
                        value={draft.xp}
                        onChange={v => update({ xp: v ?? 0 })}
                        label="XP"
                        min={0}
                        placeholder="0"
                        title="XP awarded for defeating this NPC"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeFormTab === 'statblock' && (
                <StatBlockTab
                  draft={draft}
                  update={update}
                  derived={derived}
                  onDeleteResource={form.deleteResource}
                />
              )}

              {activeFormTab === 'inventory' && (
                <>
                  {/* ===== Inventory ===== */}
                  <div className="flex flex-1 flex-col space-y-3">
                    {/* Item search */}
                    <div className="border-accent-purple-border bg-accent-purple-bg/30 rounded-lg border p-3">
                      <ItemAutocomplete
                        items={dbItems}
                        magicItems={dbMagicItems}
                        loading={dbItemsLoading}
                        onSelect={(item: ProcessedItem) => {
                          update(d => ({
                            inventoryItems: [
                              ...d.inventoryItems,
                              {
                                id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                name: item.name,
                                quantity: 1,
                                category: item.category,
                                weight: item.weight,
                                value: item.value,
                                rarity:
                                  item.rarity !== 'none'
                                    ? item.rarity
                                    : undefined,
                                description: item.description,
                                type: item.rawType,
                              },
                            ],
                          }));
                        }}
                        placeholder="Search items database..."
                      />
                    </div>

                    {/* Item list */}
                    {draft.inventoryItems.map((item, index) => (
                      <div
                        key={item.id}
                        className="border-divider bg-surface-raised rounded-lg border p-3"
                      >
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Input
                                value={item.name}
                                onChange={e => {
                                  const updated = [...draft.inventoryItems];
                                  updated[index] = {
                                    ...item,
                                    name: e.target.value,
                                  };
                                  update({ inventoryItems: updated });
                                }}
                                placeholder="Item name"
                                className="flex-1"
                              />
                              <NumberField
                                min={1}
                                value={item.quantity}
                                onChange={v => {
                                  const updated = [...draft.inventoryItems];
                                  updated[index] = {
                                    ...item,
                                    quantity: v ?? 1,
                                  };
                                  update({ inventoryItems: updated });
                                }}
                                className="bg-surface border-divider text-heading w-16 rounded border px-2 py-1.5 text-center text-sm"
                                title="Quantity"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingInventoryItemId(item.id);
                                  setInventoryEditFormOpen(true);
                                }}
                                className="text-muted hover:text-accent-blue-text shrink-0 p-1 transition-colors"
                                title="Edit item details"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  update({
                                    inventoryItems: draft.inventoryItems.filter(
                                      (_, i) => i !== index
                                    ),
                                  })
                                }
                                className="text-muted hover:text-accent-red-text shrink-0 p-1 transition-colors"
                                title="Remove item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                            {/* Details row */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                              {item.category && (
                                <span className="text-muted capitalize">
                                  {item.category}
                                </span>
                              )}
                              {item.rarity && item.rarity !== 'none' && (
                                <span className="text-accent-amber-text capitalize">
                                  {item.rarity}
                                </span>
                              )}
                              {item.weight !== undefined && (
                                <span className="text-muted">
                                  {item.weight} lbs
                                </span>
                              )}
                              {item.value !== undefined && (
                                <span className="text-muted">
                                  {formatCurrencyFromCopper(item.value)}
                                </span>
                              )}
                              <label className="text-muted ml-auto flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={item.equipped ?? false}
                                  onChange={e => {
                                    const updated = [...draft.inventoryItems];
                                    updated[index] = {
                                      ...item,
                                      equipped: e.target.checked,
                                    };
                                    update({ inventoryItems: updated });
                                  }}
                                  className="rounded"
                                />
                                Equipped
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Manual add */}
                    <button
                      onClick={() =>
                        update({
                          inventoryItems: [
                            ...draft.inventoryItems,
                            {
                              id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                              name: '',
                              quantity: 1,
                            },
                          ],
                        })
                      }
                      className="text-accent-purple-text flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100"
                    >
                      <Plus size={12} />
                      Add Item Manually
                    </button>
                  </div>
                </>
              )}

              {activeFormTab === 'spellcasting' && (
                <SpellsTab
                  draft={draft}
                  update={update}
                  proficiencyBonus={derived.proficiencyBonus}
                />
              )}

              {activeFormTab === 'lore' && (
                <>
                  {/* ===== Lore ===== */}
                  <CompactRichTextEditor
                    content={draft.loreHtml}
                    onChange={loreHtml => update({ loreHtml })}
                    placeholder="Write NPC lore, backstory, motivations..."
                    minHeight="120px"
                  />
                </>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ItemForm
        isOpen={inventoryEditFormOpen}
        onClose={() => {
          setInventoryEditFormOpen(false);
          setEditingInventoryItemId(null);
        }}
        onSubmit={handleInventoryEditSubmit}
        initialData={
          editingInventoryItem
            ? npcInventoryItemToFormData(editingInventoryItem)
            : initialInventoryFormData
        }
        availableLocations={[]}
        isEditing
        databaseItems={dbItems}
        databaseMagicItems={dbMagicItems}
        itemsLoading={dbItemsLoading}
      />
    </>
  );
}
