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
  ArrowUp,
  ArrowDown,
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
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { CompactRichTextEditor } from '@/components/ui/forms/CompactRichTextEditor';
import { Badge } from '@/components/ui/layout/badge';
import { Switch } from '@/components/ui/forms/switch';
import {
  CampaignNPC,
  MonsterStatBlock,
  NPCInventoryItem,
  NPCSpellcastingAbility,
} from '@/types/encounter';
import { FULL_CASTER_SPELL_SLOTS } from '@/utils/constants';
import { getNPCSpellcastingAbilityScore } from '@/utils/npcSpellcasting';
import { ProcessedMonster, CREATURE_TYPES, SIZES } from '@/types/bestiary';
import { ProcessedItem } from '@/types/items';
import {
  buildMonsterStatBlock,
  parseRechargeFromName,
} from '@/utils/encounterConverter';
import { ItemAutocomplete } from '@/components/ui/forms/ItemAutocomplete';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';
import { formatCurrencyFromCopper } from '@/utils/currency';
import {
  ItemForm,
  initialInventoryFormData,
} from '@/components/ui/game/inventory/ItemForm';
import type { InventoryFormData } from '@/components/ui/game/inventory/ItemForm';
import {
  npcInventoryItemToFormData,
  formDataToNpcInventoryPatch,
} from '@/utils/npcInventoryItemForm';

interface NamedText {
  name: string;
  text: string;
  uses?: number;
}

interface NPCFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    data: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>
  ) => void;
  editingNpc?: CampaignNPC | null;
  existingGroups?: string[];
}

const DEFAULT_ABILITY = 10;

const DIE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

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

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function abilityModNum(score: number): number {
  return Math.floor((score - 10) / 2);
}

function crToProficiencyBonus(crStr: string): number {
  const cr = parseFloat(crStr);
  if (isNaN(cr)) return 2;
  if (cr <= 4) return 2;
  if (cr <= 8) return 3;
  if (cr <= 12) return 4;
  if (cr <= 16) return 5;
  if (cr <= 20) return 6;
  if (cr <= 24) return 7;
  if (cr <= 28) return 8;
  return 9;
}

function parseHpFormula(
  formula: string
): { max: number; dieType: string } | null {
  const match = formula.match(/(\d+)d(\d+)/);
  if (!match) return null;
  return { max: parseInt(match[1], 10), dieType: `d${match[2]}` };
}

function hasSkillProficiency(skillsStr: string, skillName: string): boolean {
  return skillsStr.toLowerCase().includes(skillName.toLowerCase());
}

function hasSubstantiveStatBlock(
  scores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  },
  details: {
    saves: string;
    skills: string;
    resistances: string;
    immunities: string;
    vulnerabilities: string;
    conditionImmunities: string;
    senses: string;
    languages: string;
    cr: string;
  },
  core: {
    size: string;
    creatureType: string;
    alignment: string;
    hpFormula: string;
    speed: string;
  },
  traits: NamedText[],
  actions: NamedText[],
  bonusActions: NamedText[],
  reactions: NamedText[],
  lairActions: NamedText[],
  bestiarySourceId: string | null
): boolean {
  const nonDefaultScore = Object.values(scores).some(
    v => v !== DEFAULT_ABILITY
  );
  const hasDetail = Object.values(details).some(v => v.trim() !== '');
  const hasCoreOverrides =
    core.size !== 'Medium' ||
    core.creatureType !== 'Humanoid' ||
    core.alignment.trim() !== '' ||
    core.hpFormula.trim() !== '' ||
    (core.speed.trim() !== '' && core.speed.trim() !== '30 ft.');
  const hasAbilities = [
    ...traits,
    ...actions,
    ...bonusActions,
    ...reactions,
    ...lairActions,
  ].some(t => t.name.trim());
  return (
    nonDefaultScore ||
    hasDetail ||
    hasCoreOverrides ||
    hasAbilities ||
    !!bestiarySourceId
  );
}

export function NPCFormDialog({
  open,
  onOpenChange,
  onSave,
  editingNpc,
  existingGroups = [],
}: NPCFormDialogProps) {
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
  const [bestiarySourceId, setBestiarySourceId] = useState<string | null>(null);
  const [bestiarySourceName, setBestiarySourceName] = useState('');

  // Portrait
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Name & description
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Group & Tags
  const [group, setGroup] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Core stats
  const [size, setSize] = useState('Medium');
  const [creatureType, setCreatureType] = useState('Humanoid');
  const [alignment, setAlignment] = useState('');
  const [ac, setAc] = useState(10);
  const [hp, setHp] = useState(10);
  const [hpFormula, setHpFormula] = useState('');
  const [speed, setSpeed] = useState('30 ft.');

  // Initiative modifier (manual override)
  const [initiativeModifier, setInitiativeModifier] = useState(0);
  const [initiativeOverridden, setInitiativeOverridden] = useState(false);

  // Ability scores
  const [str, setStr] = useState(DEFAULT_ABILITY);
  const [dex, setDex] = useState(DEFAULT_ABILITY);
  const [con, setCon] = useState(DEFAULT_ABILITY);
  const [int, setInt] = useState(DEFAULT_ABILITY);
  const [wis, setWis] = useState(DEFAULT_ABILITY);
  const [cha, setCha] = useState(DEFAULT_ABILITY);

  // Details
  const [saves, setSaves] = useState('');
  const [skills, setSkills] = useState('');
  const [resistances, setResistances] = useState('');
  const [immunities, setImmunities] = useState('');
  const [vulnerabilities, setVulnerabilities] = useState('');
  const [conditionImmunities, setConditionImmunities] = useState('');
  const [senses, setSenses] = useState('');
  const [languages, setLanguages] = useState('');
  const [cr, setCr] = useState('');

  // Hit dice
  const [hitDiceMax, setHitDiceMax] = useState(0);
  const [hitDieCurrent, setHitDieCurrent] = useState(0);
  const [hitDieType, setHitDieType] = useState('d8');

  // Proficiency bonus (manual override)
  const [proficiencyBonus, setProficiencyBonus] = useState(2);
  const [proficiencyOverridden, setProficiencyOverridden] = useState(false);

  // Passive abilities (manual override)
  const [passivePerception, setPassivePerception] = useState(10);
  const [passiveInsight, setPassiveInsight] = useState(10);
  const [passiveInvestigation, setPassiveInvestigation] = useState(10);
  const [passivesOverridden, setPassivesOverridden] = useState(false);

  // Traits / Actions / Bonus Actions / Reactions / Lair Actions
  const [traits, setTraits] = useState<NamedText[]>([]);
  const [actions, setActions] = useState<NamedText[]>([]);
  const [bonusActions, setBonusActions] = useState<NamedText[]>([]);
  const [reactions, setReactions] = useState<NamedText[]>([]);
  const [lairActions, setLairActions] = useState<NamedText[]>([]);

  // Inventory
  const [inventoryItems, setInventoryItems] = useState<NPCInventoryItem[]>([]);
  const [inventoryEditFormOpen, setInventoryEditFormOpen] = useState(false);
  const [editingInventoryItemId, setEditingInventoryItemId] = useState<
    string | null
  >(null);

  // Lore
  const [loreHtml, setLoreHtml] = useState('');

  // Spellcasting
  const [spellcastingEnabled, setSpellcastingEnabled] = useState(false);
  const [casterLevel, setCasterLevel] = useState(1);
  const [spellcastingAbility, setSpellcastingAbility] =
    useState<NPCSpellcastingAbility>('intelligence');
  const [spellAttackOverride, setSpellAttackOverride] = useState<string>('');
  const [spellDCOverride, setSpellDCOverride] = useState<string>('');
  const [spellSlotOverrides, setSpellSlotOverrides] = useState<
    Record<number, string>
  >({});

  // ---------- Auto-calc initiative from DEX ----------

  useEffect(() => {
    if (!initiativeOverridden) {
      setInitiativeModifier(abilityModNum(dex));
    }
  }, [dex, initiativeOverridden]);

  // ---------- Auto-calc proficiency from CR ----------

  useEffect(() => {
    if (!proficiencyOverridden) {
      setProficiencyBonus(crToProficiencyBonus(cr));
    }
  }, [cr, proficiencyOverridden]);

  // ---------- Auto-calc passives from ability scores ----------

  useEffect(() => {
    if (!passivesOverridden) {
      const wisM = abilityModNum(wis);
      const intM = abilityModNum(int);
      const hasPerception = hasSkillProficiency(skills, 'perception');
      setPassivePerception(10 + wisM + (hasPerception ? proficiencyBonus : 0));
      setPassiveInsight(10 + wisM);
      setPassiveInvestigation(10 + intM);
    }
  }, [wis, int, skills, proficiencyBonus, passivesOverridden]);

  // ---------- Reset / Populate from editingNpc ----------

  useEffect(() => {
    if (!open) return;

    if (editingNpc) {
      setName(editingNpc.name);
      setDescription(editingNpc.description ?? '');
      setAc(editingNpc.armorClass);
      setHp(editingNpc.maxHp);
      setSpeed(editingNpc.speed);
      setAvatarUrl(editingNpc.avatarUrl ?? '');
      setBestiarySourceId(editingNpc.bestiarySourceId ?? null);
      setBestiarySourceName(editingNpc.bestiarySourceId ? editingNpc.name : '');
      setLoreHtml(editingNpc.loreHtml ?? '');
      setInventoryItems(editingNpc.inventory ?? []);
      setActiveFormTab('basic');

      // Spellcasting
      if (editingNpc?.spellcasting) {
        setSpellcastingEnabled(true);
        setCasterLevel(editingNpc.spellcasting.casterLevel);
        setSpellcastingAbility(editingNpc.spellcasting.ability);
        setSpellAttackOverride(
          editingNpc.spellcasting.spellAttackBonus !== undefined
            ? String(editingNpc.spellcasting.spellAttackBonus)
            : ''
        );
        setSpellDCOverride(
          editingNpc.spellcasting.spellSaveDC !== undefined
            ? String(editingNpc.spellcasting.spellSaveDC)
            : ''
        );
        const overrides: Record<number, string> = {};
        if (editingNpc.spellcasting.slotOverrides) {
          for (const [lvl, count] of Object.entries(
            editingNpc.spellcasting.slotOverrides
          )) {
            overrides[Number(lvl)] = String(count);
          }
        }
        setSpellSlotOverrides(overrides);
      } else {
        setSpellcastingEnabled(false);
        setCasterLevel(1);
        setSpellcastingAbility('intelligence');
        setSpellAttackOverride('');
        setSpellDCOverride('');
        setSpellSlotOverrides({});
      }

      // Group & tags
      setGroup(editingNpc.group ?? '');
      setTags(editingNpc.tags ?? []);
      setTagInput('');

      // Initiative modifier
      if (editingNpc.initiativeModifier !== undefined) {
        setInitiativeModifier(editingNpc.initiativeModifier);
        setInitiativeOverridden(true);
      } else {
        setInitiativeOverridden(false);
      }

      // Proficiency bonus
      if (editingNpc.proficiencyBonus !== undefined) {
        setProficiencyBonus(editingNpc.proficiencyBonus);
        setProficiencyOverridden(true);
      } else {
        setProficiencyOverridden(false);
      }

      // Passive abilities
      if (
        editingNpc.passivePerception !== undefined ||
        editingNpc.passiveInsight !== undefined ||
        editingNpc.passiveInvestigation !== undefined
      ) {
        setPassivePerception(editingNpc.passivePerception ?? 10);
        setPassiveInsight(editingNpc.passiveInsight ?? 10);
        setPassiveInvestigation(editingNpc.passiveInvestigation ?? 10);
        setPassivesOverridden(true);
      } else {
        setPassivesOverridden(false);
      }

      // Hit dice
      if (editingNpc.hitDice) {
        setHitDiceMax(editingNpc.hitDice.max);
        setHitDieCurrent(editingNpc.hitDice.current);
        setHitDieType(editingNpc.hitDice.dieType);
      } else {
        setHitDiceMax(0);
        setHitDieCurrent(0);
        setHitDieType('d8');
      }

      const sb = editingNpc.monsterStatBlock;
      if (sb) {
        setStr(sb.str);
        setDex(sb.dex);
        setCon(sb.con);
        setInt(sb.int);
        setWis(sb.wis);
        setCha(sb.cha);
        setSize(sb.size || 'Medium');
        setCreatureType(sb.type || 'Humanoid');
        setAlignment(sb.alignment || '');
        setHpFormula(sb.hpFormula || '');
        setSaves(sb.saves || '');
        setSkills(sb.skills || '');
        setResistances(sb.resistances || '');
        setImmunities(sb.immunities || '');
        setVulnerabilities(sb.vulnerabilities || '');
        setConditionImmunities(
          Array.isArray(sb.conditionImmunities)
            ? sb.conditionImmunities.join(', ')
            : ''
        );
        setSenses(sb.senses || '');
        setLanguages(sb.languages || '');
        setCr(sb.cr || '');
        setTraits(sb.traits?.map(t => ({ ...t })) ?? []);
        setActions(sb.actions?.map(a => ({ ...a })) ?? []);
        setBonusActions(sb.bonusActions?.map(b => ({ ...b })) ?? []);
        setReactions(sb.reactions?.map(r => ({ ...r })) ?? []);
        setLairActions(sb.lairActions?.map(l => ({ ...l })) ?? []);
      } else if (editingNpc.abilityScores) {
        setStr(editingNpc.abilityScores.str);
        setDex(editingNpc.abilityScores.dex);
        setCon(editingNpc.abilityScores.con);
        setInt(editingNpc.abilityScores.int);
        setWis(editingNpc.abilityScores.wis);
        setCha(editingNpc.abilityScores.cha);
        setSize('Medium');
        setCreatureType('Humanoid');
        setAlignment('');
        setHpFormula('');
        resetDetailFields();
      } else {
        resetAbilityScores();
        setSize('Medium');
        setCreatureType('Humanoid');
        setAlignment('');
        setHpFormula('');
        resetDetailFields();
      }
    } else {
      resetAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNpc, open]);

  function resetAbilityScores() {
    setStr(DEFAULT_ABILITY);
    setDex(DEFAULT_ABILITY);
    setCon(DEFAULT_ABILITY);
    setInt(DEFAULT_ABILITY);
    setWis(DEFAULT_ABILITY);
    setCha(DEFAULT_ABILITY);
  }

  function resetDetailFields() {
    setSaves('');
    setSkills('');
    setResistances('');
    setImmunities('');
    setVulnerabilities('');
    setConditionImmunities('');
    setSenses('');
    setLanguages('');
    setCr('');
    setTraits([]);
    setActions([]);
    setBonusActions([]);
    setReactions([]);
    setLairActions([]);
    setHitDiceMax(0);
    setHitDieCurrent(0);
    setHitDieType('d8');
    setProficiencyBonus(2);
    setProficiencyOverridden(false);
    setPassivePerception(10);
    setPassiveInsight(10);
    setPassiveInvestigation(10);
    setPassivesOverridden(false);
  }

  function resetAll() {
    setActiveFormTab('basic');
    setName('');
    setDescription('');
    setAc(10);
    setHp(10);
    setHpFormula('');
    setSpeed('30 ft.');
    setSize('Medium');
    setCreatureType('Humanoid');
    setAlignment('');
    setAvatarUrl('');
    setBestiarySourceId(null);
    setBestiarySourceName('');
    setLoreHtml('');
    setInventoryItems([]);
    setBestiaryQuery('');
    setBestiaryResults([]);
    setGroup('');
    setTags([]);
    setTagInput('');
    setInitiativeModifier(0);
    setInitiativeOverridden(false);
    setSpellcastingEnabled(false);
    setCasterLevel(1);
    setSpellcastingAbility('intelligence');
    setSpellAttackOverride('');
    setSpellDCOverride('');
    setSpellSlotOverrides({});
    resetAbilityScores();
    resetDetailFields();
  }

  // ---------- Tag handling ----------

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    }
  };

  const addTag = (raw: string) => {
    const trimmed = raw.trim().replace(/,$/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
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
    const sb = buildMonsterStatBlock(monster);
    setName(monster.name);
    setDescription('');
    setAc(monster.acValue);
    setHp(monster.hpAverage);
    setHpFormula(monster.hpFormula);
    setSpeed(sb.speed);
    setSize(sb.size);
    setCreatureType(sb.type);
    setAlignment(sb.alignment);
    setStr(sb.str);
    setDex(sb.dex);
    setCon(sb.con);
    setInt(sb.int);
    setWis(sb.wis);
    setCha(sb.cha);
    setSaves(sb.saves);
    setSkills(sb.skills);
    setResistances(sb.resistances);
    setImmunities(sb.immunities);
    setVulnerabilities(sb.vulnerabilities);
    setConditionImmunities(
      Array.isArray(sb.conditionImmunities)
        ? sb.conditionImmunities.join(', ')
        : ''
    );
    setSenses(sb.senses);
    setLanguages(sb.languages);
    setCr(sb.cr);
    const autoUses = (entry: { name: string; text: string; uses?: number }) => {
      if (entry.uses !== undefined) return { ...entry };
      const parsed = parseRechargeFromName(entry.name);
      return parsed.maxUses ? { ...entry, uses: parsed.maxUses } : { ...entry };
    };
    setTraits(sb.traits.map(autoUses));
    setActions(sb.actions.map(autoUses));
    setBonusActions(sb.bonusActions.map(autoUses));
    setReactions(sb.reactions.map(autoUses));
    setLairActions([]);
    setBestiarySourceId(monster.id);
    setBestiarySourceName(monster.name);
    setBestiaryQuery('');
    setBestiaryResults([]);

    // Auto-populate hit dice from hpFormula
    const parsedHd = parseHpFormula(monster.hpFormula);
    if (parsedHd) {
      setHitDiceMax(parsedHd.max);
      setHitDieCurrent(parsedHd.max);
      setHitDieType(
        DIE_TYPES.includes(parsedHd.dieType) ? parsedHd.dieType : 'd8'
      );
    }

    // Auto-populate initiative modifier from DEX
    const dexMod = abilityModNum(sb.dex);
    setInitiativeModifier(dexMod);
    setInitiativeOverridden(false);

    // Auto-populate proficiency bonus from CR
    const prof = crToProficiencyBonus(sb.cr);
    setProficiencyBonus(prof);
    setProficiencyOverridden(false);

    // Auto-populate passive perception from stat block
    if (sb.passivePerception) {
      setPassivePerception(sb.passivePerception);
    } else {
      setPassivePerception(10 + abilityModNum(sb.wis));
    }
    setPassiveInsight(10 + abilityModNum(sb.wis));
    setPassiveInvestigation(10 + abilityModNum(sb.int));
    setPassivesOverridden(false);
  };

  const clearBestiarySource = () => {
    setBestiarySourceId(null);
    setBestiarySourceName('');
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

      if (avatarUrl && avatarUrl.includes('s3.amazonaws.com')) {
        fetch(`/api/npc/delete?url=${encodeURIComponent(avatarUrl)}`, {
          method: 'DELETE',
        }).catch(() => {});
      }

      setAvatarUrl(url);
    } catch {
      // silently fail
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    if (avatarUrl && avatarUrl.includes('s3.amazonaws.com')) {
      fetch(`/api/npc/delete?url=${encodeURIComponent(avatarUrl)}`, {
        method: 'DELETE',
      }).catch(() => {});
    }
    setAvatarUrl('');
  };

  // ---------- Save ----------

  const handleSubmit = () => {
    if (!name.trim()) return;

    const scores = { str, dex, con, int, wis, cha };
    const detailFields = {
      saves,
      skills,
      resistances,
      immunities,
      vulnerabilities,
      conditionImmunities,
      senses,
      languages,
      cr,
    };
    const coreFields = {
      size,
      creatureType,
      alignment,
      hpFormula,
      speed,
    };

    const shouldPersistStatBlock =
      !bestiarySourceId ||
      hasSubstantiveStatBlock(
        scores,
        detailFields,
        coreFields,
        traits,
        actions,
        bonusActions,
        reactions,
        lairActions,
        bestiarySourceId
      );

    let monsterStatBlock: MonsterStatBlock | undefined;
    if (shouldPersistStatBlock) {
      monsterStatBlock = {
        str,
        dex,
        con,
        int,
        wis,
        cha,
        saves: saves || '',
        skills: skills || '',
        speed: speed || '30 ft.',
        resistances: resistances || '',
        immunities: immunities || '',
        vulnerabilities: vulnerabilities || '',
        conditionImmunities: conditionImmunities
          ? conditionImmunities
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
          : [],
        senses: senses || '',
        passivePerception: passivePerception,
        traits: traits.filter(t => t.name.trim()),
        actions: actions.filter(a => a.name.trim()),
        bonusActions: bonusActions.filter(a => a.name.trim()),
        reactions: reactions.filter(r => r.name.trim()),
        lairActions: lairActions.filter(a => a.name.trim()),
        cr: cr || '0',
        type: creatureType,
        size,
        languages: languages || '',
        alignment,
        hpFormula: hpFormula || '',
      };
    }

    const payload: Omit<
      CampaignNPC,
      'id' | 'campaignCode' | 'createdAt' | 'updatedAt'
    > = {
      name: name.trim(),
      armorClass: ac,
      maxHp: hp,
      speed: speed.trim() || '30 ft.',
      description: description.trim() || undefined,
      monsterStatBlock,
      bestiarySourceId: bestiarySourceId ?? undefined,
      loreHtml: loreHtml.trim() || undefined,
      avatarUrl: avatarUrl || undefined,
      group: group.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      hitDice:
        hitDiceMax > 0
          ? { max: hitDiceMax, current: hitDieCurrent, dieType: hitDieType }
          : undefined,
      initiativeModifier,
      proficiencyBonus,
      passivePerception,
      passiveInsight,
      passiveInvestigation,
      inventory:
        inventoryItems.length > 0
          ? inventoryItems.filter(item => item.name.trim())
          : undefined,
      spellcasting: spellcastingEnabled
        ? {
            casterLevel,
            ability: spellcastingAbility,
            spellAttackBonus: spellAttackOverride
              ? parseInt(spellAttackOverride)
              : undefined,
            spellSaveDC: spellDCOverride
              ? parseInt(spellDCOverride)
              : undefined,
            slotOverrides:
              Object.keys(spellSlotOverrides).length > 0
                ? Object.fromEntries(
                    Object.entries(spellSlotOverrides)
                      .filter(([, v]) => v !== '')
                      .map(([k, v]) => [Number(k), parseInt(v)])
                  )
                : undefined,
            slotsUsed: editingNpc?.spellcasting?.slotsUsed ?? {},
            spells: editingNpc?.spellcasting?.spells ?? [],
          }
        : undefined,
    };

    onSave(payload);
    onOpenChange(false);
  };

  const canSubmit = name.trim().length > 0;
  const submitLabel = editingNpc ? 'Save Changes' : 'Create NPC';

  const editingInventoryItem = editingInventoryItemId
    ? inventoryItems.find(i => i.id === editingInventoryItemId)
    : undefined;

  const handleInventoryEditSubmit = (data: InventoryFormData) => {
    if (!editingInventoryItemId) return;
    setInventoryItems(prev =>
      prev.map(item =>
        item.id === editingInventoryItemId
          ? formDataToNpcInventoryPatch(data, item)
          : item
      )
    );
    setInventoryEditFormOpen(false);
    setEditingInventoryItemId(null);
  };

  // ---------- Render ----------

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader className="flex flex-col gap-3 space-y-0 pr-10 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <DialogTitle className="shrink-0">
              {editingNpc ? 'Edit NPC' : 'Create NPC'}
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
                onClick={handleSubmit}
                disabled={!canSubmit}
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
          <DialogBody className="h-[60vh] shrink-0 overflow-y-auto">
            <div className="flex min-h-full flex-col space-y-5">
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

                      {bestiarySourceId && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            Imported from: {bestiarySourceName}
                          </Badge>
                          <button
                            onClick={clearBestiarySource}
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
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt="NPC portrait"
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
                        {avatarUrl
                          ? 'Portrait uploaded'
                          : 'Click to upload portrait'}
                      </span>
                      {avatarUrl && (
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
                      value={name}
                      onChange={e => setName(e.target.value)}
                      label="Name"
                      placeholder="NPC name"
                      required
                      autoFocus
                    />
                    <Input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
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
                        value={group}
                        onChange={e => setGroup(e.target.value)}
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
                        {tags.map(tag => (
                          <span
                            key={tag}
                            className="bg-accent-purple-bg text-accent-purple-text flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
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
                          onBlur={() => tagInput.trim() && addTag(tagInput)}
                          placeholder={
                            tags.length === 0 ? 'Add tags (Enter or comma)' : ''
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
                        value={size}
                        onValueChange={setSize}
                      >
                        {SIZES.map((s: string) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectField>
                      <SelectField
                        label="Type"
                        value={creatureType}
                        onValueChange={setCreatureType}
                      >
                        {CREATURE_TYPES.map((t: string) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectField>
                      <Input
                        value={alignment}
                        onChange={e => setAlignment(e.target.value)}
                        label="Alignment"
                        placeholder="Unaligned"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        value={ac}
                        onChange={e => setAc(parseInt(e.target.value) || 0)}
                        label="AC"
                        min={0}
                      />
                      <Input
                        type="number"
                        value={hp}
                        onChange={e => setHp(parseInt(e.target.value) || 1)}
                        label="HP"
                        min={1}
                      />
                      <Input
                        value={hpFormula}
                        onChange={e => setHpFormula(e.target.value)}
                        label="HP Formula"
                        placeholder="2d8+2"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={speed}
                        onChange={e => setSpeed(e.target.value)}
                        label="Speed"
                        placeholder="30 ft., fly 60 ft."
                      />
                      <Input
                        type="number"
                        value={initiativeModifier}
                        onChange={e => {
                          setInitiativeModifier(parseInt(e.target.value) || 0);
                          setInitiativeOverridden(true);
                        }}
                        label="Init Mod"
                        title="Initiative modifier (auto-calculated from DEX, overridable)"
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
                          ['STR', str, setStr],
                          ['DEX', dex, setDex],
                          ['CON', con, setCon],
                          ['INT', int, setInt],
                          ['WIS', wis, setWis],
                          ['CHA', cha, setCha],
                        ] as const
                      ).map(([label, value, setter]) => (
                        <div key={label} className="text-center">
                          <span className="text-muted block text-[10px] font-medium uppercase">
                            {label}
                          </span>
                          <input
                            type="number"
                            value={value}
                            onChange={e =>
                              (
                                setter as React.Dispatch<
                                  React.SetStateAction<number>
                                >
                              )(parseInt(e.target.value) || 0)
                            }
                            min={1}
                            max={30}
                            className="bg-surface border-divider text-heading w-full rounded border px-1 py-1 text-center text-sm"
                          />
                          <span className="text-muted text-[10px]">
                            {abilityMod(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ===== Details ===== */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={saves}
                        onChange={e => setSaves(e.target.value)}
                        label="Saving Throws"
                        placeholder="Dex +4, Wis +2"
                      />
                      <Input
                        value={skills}
                        onChange={e => setSkills(e.target.value)}
                        label="Skills"
                        placeholder="Perception +4, Stealth +6"
                      />
                      <Input
                        value={resistances}
                        onChange={e => setResistances(e.target.value)}
                        label="Resistances"
                        placeholder="fire, cold"
                      />
                      <Input
                        value={immunities}
                        onChange={e => setImmunities(e.target.value)}
                        label="Immunities"
                        placeholder="poison"
                      />
                      <Input
                        value={vulnerabilities}
                        onChange={e => setVulnerabilities(e.target.value)}
                        label="Vulnerabilities"
                        placeholder="radiant"
                      />
                      <Input
                        value={conditionImmunities}
                        onChange={e => setConditionImmunities(e.target.value)}
                        label="Condition Immunities"
                        placeholder="poisoned, charmed"
                      />
                      <Input
                        value={senses}
                        onChange={e => setSenses(e.target.value)}
                        label="Senses"
                        placeholder="Darkvision 60 ft."
                      />
                      <Input
                        value={languages}
                        onChange={e => setLanguages(e.target.value)}
                        label="Languages"
                        placeholder="Common, Sylvan"
                      />
                    </div>

                    {/* CR & Proficiency Bonus */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="w-full">
                        <Input
                          value={cr}
                          onChange={e => setCr(e.target.value)}
                          label="CR"
                          placeholder="0"
                        />
                      </div>
                      <Input
                        type="number"
                        value={proficiencyBonus}
                        onChange={e => {
                          setProficiencyBonus(parseInt(e.target.value) || 2);
                          setProficiencyOverridden(true);
                        }}
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
                        <Input
                          type="number"
                          value={hitDiceMax}
                          onChange={e =>
                            setHitDiceMax(parseInt(e.target.value) || 0)
                          }
                          label="Max"
                          min={0}
                          placeholder="8"
                        />
                        <SelectField
                          label="Die Type"
                          value={hitDieType}
                          onValueChange={setHitDieType}
                        >
                          {DIE_TYPES.map(d => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectField>
                        <Input
                          type="number"
                          value={hitDieCurrent}
                          onChange={e =>
                            setHitDieCurrent(parseInt(e.target.value) || 0)
                          }
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
                        <Input
                          type="number"
                          value={passivePerception}
                          onChange={e => {
                            setPassivePerception(parseInt(e.target.value) || 0);
                            setPassivesOverridden(true);
                          }}
                          label="Passive Perception"
                          min={1}
                        />
                        <Input
                          type="number"
                          value={passiveInsight}
                          onChange={e => {
                            setPassiveInsight(parseInt(e.target.value) || 0);
                            setPassivesOverridden(true);
                          }}
                          label="Passive Insight"
                          min={1}
                        />
                        <Input
                          type="number"
                          value={passiveInvestigation}
                          onChange={e => {
                            setPassiveInvestigation(
                              parseInt(e.target.value) || 0
                            );
                            setPassivesOverridden(true);
                          }}
                          label="Passive Investigation"
                          min={1}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ===== Traits / Actions / Reactions ===== */}
                  <AbilityListEditor
                    label="Traits"
                    items={traits}
                    onChange={setTraits}
                  />
                  <AbilityListEditor
                    label="Actions"
                    items={actions}
                    onChange={setActions}
                  />
                  <AbilityListEditor
                    label="Bonus Actions"
                    items={bonusActions}
                    onChange={setBonusActions}
                  />
                  <AbilityListEditor
                    label="Reactions"
                    items={reactions}
                    onChange={setReactions}
                  />
                  <AbilityListEditor
                    label="Lair Actions"
                    items={lairActions}
                    onChange={setLairActions}
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
                          setInventoryItems(prev => [
                            ...prev,
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
                          ]);
                        }}
                        placeholder="Search items database..."
                      />
                    </div>

                    {/* Item list */}
                    {inventoryItems.map((item, index) => (
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
                                  const updated = [...inventoryItems];
                                  updated[index] = {
                                    ...item,
                                    name: e.target.value,
                                  };
                                  setInventoryItems(updated);
                                }}
                                placeholder="Item name"
                                className="flex-1"
                              />
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={e => {
                                  const updated = [...inventoryItems];
                                  updated[index] = {
                                    ...item,
                                    quantity: parseInt(e.target.value) || 1,
                                  };
                                  setInventoryItems(updated);
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
                                  setInventoryItems(
                                    inventoryItems.filter((_, i) => i !== index)
                                  )
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
                                    const updated = [...inventoryItems];
                                    updated[index] = {
                                      ...item,
                                      equipped: e.target.checked,
                                    };
                                    setInventoryItems(updated);
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
                        setInventoryItems([
                          ...inventoryItems,
                          {
                            id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                            name: '',
                            quantity: 1,
                          },
                        ])
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
                        checked={spellcastingEnabled}
                        onCheckedChange={setSpellcastingEnabled}
                        id="spellcasting-enabled"
                      />
                      <label
                        htmlFor="spellcasting-enabled"
                        className="text-body text-sm font-medium"
                      >
                        Enable Spellcasting
                      </label>
                    </div>

                    {spellcastingEnabled && (
                      <div className="space-y-3">
                        {/* Caster Level + Ability */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-muted mb-1 block text-xs font-medium">
                              Caster Level
                            </label>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={casterLevel}
                              onChange={e =>
                                setCasterLevel(
                                  Math.max(
                                    1,
                                    Math.min(20, parseInt(e.target.value) || 1)
                                  )
                                )
                              }
                            />
                          </div>
                          <div>
                            <label className="text-muted mb-1 block text-xs font-medium">
                              Spellcasting Ability
                            </label>
                            <SelectField
                              value={spellcastingAbility}
                              onValueChange={v =>
                                setSpellcastingAbility(
                                  v as NPCSpellcastingAbility
                                )
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
                            spellcastingAbility,
                            { str, dex, con, int, wis, cha }
                          );
                          const prof = proficiencyBonus;
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
                              {spellcastingAbility.charAt(0).toUpperCase() +
                                spellcastingAbility.slice(1)}{' '}
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
                            <Input
                              type="number"
                              placeholder="Auto"
                              value={spellAttackOverride}
                              onChange={e =>
                                setSpellAttackOverride(e.target.value)
                              }
                            />
                          </div>
                          <div>
                            <label className="text-muted mb-1 block text-xs font-medium">
                              Save DC Override
                            </label>
                            <Input
                              type="number"
                              placeholder="Auto"
                              value={spellDCOverride}
                              onChange={e => setSpellDCOverride(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Spell Slot Overrides */}
                        <div>
                          <label className="text-muted mb-1 block text-xs font-medium">
                            Spell Slots (by Caster Level {casterLevel})
                          </label>
                          <div className="bg-surface-secondary border-divider rounded-md border p-2">
                            <div className="space-y-1">
                              {(() => {
                                const baseSlots =
                                  FULL_CASTER_SPELL_SLOTS[casterLevel] ?? {};
                                const levels = Array.from(
                                  { length: 9 },
                                  (_, i) => i + 1
                                );
                                const activeLevels = levels.filter(
                                  lvl =>
                                    (baseSlots[lvl] ?? 0) > 0 ||
                                    spellSlotOverrides[lvl]
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
                                    <Input
                                      type="number"
                                      min={0}
                                      placeholder={String(baseSlots[lvl] ?? 0)}
                                      value={spellSlotOverrides[lvl] ?? ''}
                                      onChange={e => {
                                        setSpellSlotOverrides(prev => ({
                                          ...prev,
                                          [lvl]: e.target.value,
                                        }));
                                      }}
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
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeFormTab === 'lore' && (
                <>
                  {/* ===== Lore ===== */}
                  <CompactRichTextEditor
                    content={loreHtml}
                    onChange={setLoreHtml}
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

function AbilityListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: NamedText[];
  onChange: (items: NamedText[]) => void;
}) {
  const handleAdd = () => {
    onChange([...items, { name: '', text: '' }]);
  };

  const handleUpdate = (
    index: number,
    field: 'name' | 'text',
    value: string
  ) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  const handleUsesChange = (index: number, value: string) => {
    const num = value === '' ? undefined : parseInt(value, 10);
    const updated = items.map((item, i) =>
      i === index ? { ...item, uses: num } : item
    );
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    onChange(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    onChange(updated);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-heading text-sm font-medium">{label}</label>
        <button
          onClick={handleAdd}
          className="text-accent-purple-text flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-faint text-xs">No {label.toLowerCase()} added</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="border-divider bg-surface-raised rounded-lg border p-2"
            >
              <div className="mb-1 flex items-center gap-2">
                {/* Reorder buttons */}
                <div className="flex shrink-0 flex-col">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="text-muted hover:text-heading disabled:text-faint p-0.5 transition-colors disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    className="text-muted hover:text-heading disabled:text-faint p-0.5 transition-colors disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
                <Input
                  value={item.name}
                  onChange={e => handleUpdate(index, 'name', e.target.value)}
                  placeholder={`${label.slice(0, -1)} name`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={0}
                  value={item.uses ?? ''}
                  onChange={e => handleUsesChange(index, e.target.value)}
                  placeholder="Uses"
                  className="w-18"
                  title="Uses per day (leave empty for unlimited)"
                />
                <button
                  onClick={() => handleRemove(index)}
                  className="text-muted hover:text-accent-red-text p-1 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <CompactRichTextEditor
                content={item.text}
                onChange={value => handleUpdate(index, 'text', value)}
                placeholder="Description..."
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
