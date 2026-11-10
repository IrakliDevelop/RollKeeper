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
import { Switch } from '@/components/ui/forms/switch';
import { CampaignNPC, NPCSpellcastingAbility } from '@/types/encounter';
import { FULL_CASTER_SPELL_SLOTS } from '@/utils/constants';
import { getNPCSpellcastingAbilityScore } from '@/utils/npcSpellcasting';
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
import { NPCSpellListEditor } from '../NPCSpellListEditor';
import { AbilityListEditor } from '../AbilityListEditor';
import { NpcResourcesEditor } from '../NpcResourcesEditor';
import { NpcInflictsEditor } from '../NpcInflictsEditor';
import type { CustomCondition } from '@/types/encounter';
import { useEncounterStore } from '@/store/encounterStore';
import { useOfficialConditions } from '@/hooks/useOfficialConditions';
import { EMPTY_CUSTOM_CONDITIONS } from '@/utils/customConditions';
import { abilityMod, DIE_TYPES, withPassiveOverride } from './npcFormDraft';
import type { AbilityKey, NpcFormDraft } from './npcFormDraft';
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
  const { conditions: officialConditions, loading: officialConditionsLoading } =
    useOfficialConditions();

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

  // Condition library
  const conditionLibrary = useEncounterStore(
    state => state.combatConfig.customConditions ?? EMPTY_CUSTOM_CONDITIONS
  );
  const setCombatConfig = useEncounterStore(state => state.setCombatConfig);

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

  const handleCreateConditionInLibrary = (condition: CustomCondition) => {
    setCombatConfig({ customConditions: [...conditionLibrary, condition] });
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
                <>
                  {/* ===== Ability Scores ===== */}
                  <div>
                    <label className="text-heading mb-1.5 block text-sm font-medium">
                      Ability Scores
                    </label>
                    <div className="grid grid-cols-6 gap-2">
                      {(
                        [
                          ['STR', 'str'],
                          ['DEX', 'dex'],
                          ['CON', 'con'],
                          ['INT', 'int'],
                          ['WIS', 'wis'],
                          ['CHA', 'cha'],
                        ] as const satisfies ReadonlyArray<
                          readonly [string, AbilityKey]
                        >
                      ).map(([label, key]) => (
                        <div key={label} className="text-center">
                          <span className="text-muted block text-[10px] font-medium uppercase">
                            {label}
                          </span>
                          <NumberField
                            value={draft[key]}
                            onChange={v =>
                              update({ [key]: v ?? 0 } as Pick<
                                NpcFormDraft,
                                AbilityKey
                              >)
                            }
                            min={1}
                            max={30}
                            className="bg-surface border-divider text-heading w-full rounded border px-1 py-1 text-center text-sm"
                          />
                          <span className="text-muted text-[10px]">
                            {abilityMod(draft[key])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ===== Details ===== */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={draft.saves}
                        onChange={e => update({ saves: e.target.value })}
                        label="Saving Throws"
                        placeholder="Dex +4, Wis +2"
                      />
                      <Input
                        value={draft.skills}
                        onChange={e => update({ skills: e.target.value })}
                        label="Skills"
                        placeholder="Perception +4, Stealth +6"
                      />
                      <Input
                        value={draft.resistances}
                        onChange={e => update({ resistances: e.target.value })}
                        label="Resistances"
                        placeholder="fire, cold"
                      />
                      <Input
                        value={draft.immunities}
                        onChange={e => update({ immunities: e.target.value })}
                        label="Immunities"
                        placeholder="poison"
                      />
                      <Input
                        value={draft.vulnerabilities}
                        onChange={e =>
                          update({ vulnerabilities: e.target.value })
                        }
                        label="Vulnerabilities"
                        placeholder="radiant"
                      />
                      <Input
                        value={draft.conditionImmunities}
                        onChange={e =>
                          update({ conditionImmunities: e.target.value })
                        }
                        label="Condition Immunities"
                        placeholder="poisoned, charmed"
                      />
                      <Input
                        value={draft.senses}
                        onChange={e => update({ senses: e.target.value })}
                        label="Senses"
                        placeholder="Darkvision 60 ft."
                      />
                      <Input
                        value={draft.languages}
                        onChange={e => update({ languages: e.target.value })}
                        label="Languages"
                        placeholder="Common, Sylvan"
                      />
                    </div>

                    {/* ===== Inflicted conditions ===== */}
                    <NpcInflictsEditor
                      conditions={draft.inflictableConditions}
                      library={conditionLibrary}
                      officialConditions={officialConditions}
                      officialConditionsLoading={officialConditionsLoading}
                      onChange={inflictableConditions =>
                        update({ inflictableConditions })
                      }
                      onCreateInLibrary={handleCreateConditionInLibrary}
                    />

                    {/* CR & Proficiency Bonus */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="w-full">
                        <Input
                          value={draft.cr}
                          onChange={e => update({ cr: e.target.value })}
                          label="CR"
                          placeholder="0"
                        />
                      </div>
                      <NumberInput
                        value={derived.proficiencyBonus}
                        onChange={v => update({ proficiencyOverride: v ?? 2 })}
                        label="Prof Bonus"
                        min={2}
                        max={9}
                        title="Proficiency bonus (auto-calculated from CR, overridable)"
                      />
                    </div>

                    {/* Hit Dice */}
                    <div>
                      <label className="text-heading mb-1.5 block text-sm font-medium">
                        Hit Dice
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <NumberInput
                          value={draft.hitDiceMax}
                          onChange={v => update({ hitDiceMax: v ?? 0 })}
                          label="Max"
                          min={0}
                          placeholder="8"
                        />
                        <SelectField
                          label="Die Type"
                          value={draft.hitDieType}
                          onValueChange={v => update({ hitDieType: v })}
                        >
                          {DIE_TYPES.map(d => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectField>
                        <NumberInput
                          value={draft.hitDieCurrent}
                          onChange={v => update({ hitDieCurrent: v ?? 0 })}
                          label="Current"
                          min={0}
                          placeholder="8"
                        />
                      </div>
                    </div>

                    {/* Passive Abilities */}
                    <div>
                      <label className="text-heading mb-1.5 block text-sm font-medium">
                        Passive Abilities
                        <span className="text-faint ml-1 text-xs font-normal">
                          (auto-calculated, overridable)
                        </span>
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <NumberInput
                          value={derived.passivePerception}
                          onChange={v =>
                            update(d =>
                              withPassiveOverride(d, 'perception', v ?? 0)
                            )
                          }
                          label="Passive Perception"
                          min={1}
                        />
                        <NumberInput
                          value={derived.passiveInsight}
                          onChange={v =>
                            update(d =>
                              withPassiveOverride(d, 'insight', v ?? 0)
                            )
                          }
                          label="Passive Insight"
                          min={1}
                        />
                        <NumberInput
                          value={derived.passiveInvestigation}
                          onChange={v =>
                            update(d =>
                              withPassiveOverride(d, 'investigation', v ?? 0)
                            )
                          }
                          label="Passive Investigation"
                          min={1}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ===== Class Resources ===== */}
                  <NpcResourcesEditor
                    resources={draft.resources}
                    onChange={resources => update({ resources })}
                    onDeleteResource={form.deleteResource}
                  />

                  {/* ===== Traits / Actions / Reactions ===== */}
                  <AbilityListEditor
                    label="Traits"
                    items={draft.traits}
                    onChange={traits => update({ traits })}
                    resources={draft.resources}
                    inventoryItems={draft.inventoryItems}
                  />
                  <AbilityListEditor
                    label="Actions"
                    items={draft.actions}
                    onChange={actions => update({ actions })}
                    resources={draft.resources}
                    inventoryItems={draft.inventoryItems}
                  />
                  <AbilityListEditor
                    label="Bonus Actions"
                    items={draft.bonusActions}
                    onChange={bonusActions => update({ bonusActions })}
                    resources={draft.resources}
                    inventoryItems={draft.inventoryItems}
                  />
                  <AbilityListEditor
                    label="Reactions"
                    items={draft.reactions}
                    onChange={reactions => update({ reactions })}
                    resources={draft.resources}
                    inventoryItems={draft.inventoryItems}
                  />
                  <AbilityListEditor
                    label="Lair Actions"
                    items={draft.lairActions}
                    onChange={lairActions => update({ lairActions })}
                    resources={draft.resources}
                    inventoryItems={draft.inventoryItems}
                  />
                </>
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
                <>
                  {/* ===== Spellcasting ===== */}
                  <div className="space-y-3">
                    {/* Enable toggle */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={draft.spellcastingEnabled}
                        onCheckedChange={v =>
                          update({ spellcastingEnabled: v })
                        }
                        id="spellcasting-enabled"
                      />
                      <label
                        htmlFor="spellcasting-enabled"
                        className="text-body text-sm font-medium"
                      >
                        Enable Spellcasting
                      </label>
                    </div>

                    {draft.spellcastingEnabled && (
                      <div className="space-y-3">
                        {/* Caster Level + Ability */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-muted mb-1 block text-xs font-medium">
                              Caster Level
                            </label>
                            <NumberInput
                              min={1}
                              max={20}
                              value={draft.casterLevel}
                              onChange={v => update({ casterLevel: v ?? 1 })}
                            />
                          </div>
                          <div>
                            <label className="text-muted mb-1 block text-xs font-medium">
                              Spellcasting Ability
                            </label>
                            <SelectField
                              value={draft.spellcastingAbility}
                              onValueChange={v =>
                                update({
                                  spellcastingAbility:
                                    v as NPCSpellcastingAbility,
                                })
                              }
                            >
                              <SelectItem value="intelligence">
                                Intelligence
                              </SelectItem>
                              <SelectItem value="wisdom">Wisdom</SelectItem>
                              <SelectItem value="charisma">Charisma</SelectItem>
                            </SelectField>
                          </div>
                        </div>

                        {/* Auto-calculated display */}
                        {(() => {
                          const abilityScore = getNPCSpellcastingAbilityScore(
                            draft.spellcastingAbility,
                            {
                              str: draft.str,
                              dex: draft.dex,
                              con: draft.con,
                              int: draft.int,
                              wis: draft.wis,
                              cha: draft.cha,
                            }
                          );
                          const prof = derived.proficiencyBonus;
                          const autoAttack =
                            Math.floor((abilityScore - 10) / 2) + prof;
                          const autoDC =
                            8 + Math.floor((abilityScore - 10) / 2) + prof;
                          return (
                            <p className="text-muted text-xs">
                              Auto: Spell Attack{' '}
                              <span className="font-semibold">
                                {autoAttack >= 0
                                  ? `+${autoAttack}`
                                  : autoAttack}
                              </span>
                              , Save DC{' '}
                              <span className="font-semibold">{autoDC}</span> (
                              {draft.spellcastingAbility
                                .charAt(0)
                                .toUpperCase() +
                                draft.spellcastingAbility.slice(1)}{' '}
                              {abilityScore}, Prof +{prof})
                            </p>
                          );
                        })()}

                        {/* Override fields */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-muted mb-1 block text-xs font-medium">
                              Spell Attack Override
                            </label>
                            <NumberInput
                              placeholder="Auto"
                              value={draft.spellAttackOverride}
                              onChange={v => update({ spellAttackOverride: v })}
                              allowEmpty
                            />
                          </div>
                          <div>
                            <label className="text-muted mb-1 block text-xs font-medium">
                              Save DC Override
                            </label>
                            <NumberInput
                              placeholder="Auto"
                              value={draft.spellDCOverride}
                              onChange={v => update({ spellDCOverride: v })}
                              allowEmpty
                            />
                          </div>
                        </div>

                        {/* Spell Slot Overrides */}
                        <div>
                          <label className="text-muted mb-1 block text-xs font-medium">
                            Spell Slots (by Caster Level {draft.casterLevel})
                          </label>
                          <div className="bg-surface-secondary border-divider rounded-md border p-2">
                            <div className="space-y-1">
                              {(() => {
                                const baseSlots =
                                  FULL_CASTER_SPELL_SLOTS[draft.casterLevel] ??
                                  {};
                                const levels = Array.from(
                                  { length: 9 },
                                  (_, i) => i + 1
                                );
                                const activeLevels = levels.filter(
                                  lvl =>
                                    (baseSlots[lvl] ?? 0) > 0 ||
                                    draft.spellSlotOverrides[lvl] !== undefined
                                );
                                if (activeLevels.length === 0) {
                                  return (
                                    <p className="text-muted text-xs italic">
                                      No spell slots at this caster level.
                                    </p>
                                  );
                                }
                                return activeLevels.map(lvl => (
                                  <div
                                    key={lvl}
                                    className="flex items-center gap-2"
                                  >
                                    <span className="text-body w-20 text-xs font-medium">
                                      Level {lvl}: {baseSlots[lvl] ?? 0}
                                    </span>
                                    <NumberInput
                                      min={0}
                                      placeholder={String(baseSlots[lvl] ?? 0)}
                                      value={draft.spellSlotOverrides[lvl]}
                                      onChange={v => {
                                        update(d => ({
                                          spellSlotOverrides: {
                                            ...d.spellSlotOverrides,
                                            [lvl]: v,
                                          },
                                        }));
                                      }}
                                      allowEmpty
                                      className="h-7 w-20 text-xs"
                                    />
                                    <span className="text-muted text-xs">
                                      override
                                    </span>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="text-muted mb-1 block text-xs font-medium">
                            Spell List
                          </label>
                          <NPCSpellListEditor
                            spells={draft.spells}
                            onChange={spells => update({ spells })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </>
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
