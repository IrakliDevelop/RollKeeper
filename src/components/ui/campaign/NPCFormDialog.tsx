'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Search,
  X,
  Plus,
  Trash2,
  ImageIcon,
  ChevronDown,
  ChevronUp,
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
import { CampaignNPC, MonsterStatBlock } from '@/types/encounter';
import { ProcessedMonster, CREATURE_TYPES, SIZES } from '@/types/bestiary';
import { buildMonsterStatBlock } from '@/utils/encounterConverter';

interface NamedText {
  name: string;
  text: string;
}

interface NPCFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    data: Omit<CampaignNPC, 'id' | 'campaignCode' | 'createdAt' | 'updatedAt'>
  ) => void;
  editingNpc?: CampaignNPC | null;
}

const DEFAULT_ABILITY = 10;

function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
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
  const hasAbilities = [
    ...traits,
    ...actions,
    ...bonusActions,
    ...reactions,
    ...lairActions,
  ].some(t => t.name.trim());
  return nonDefaultScore || hasDetail || hasAbilities || !!bestiarySourceId;
}

export function NPCFormDialog({
  open,
  onOpenChange,
  onSave,
  editingNpc,
}: NPCFormDialogProps) {
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

  // Core stats
  const [size, setSize] = useState('Medium');
  const [creatureType, setCreatureType] = useState('Humanoid');
  const [alignment, setAlignment] = useState('');
  const [ac, setAc] = useState(10);
  const [hp, setHp] = useState(10);
  const [hpFormula, setHpFormula] = useState('');
  const [speed, setSpeed] = useState('30 ft.');

  // Ability scores
  const [str, setStr] = useState(DEFAULT_ABILITY);
  const [dex, setDex] = useState(DEFAULT_ABILITY);
  const [con, setCon] = useState(DEFAULT_ABILITY);
  const [int, setInt] = useState(DEFAULT_ABILITY);
  const [wis, setWis] = useState(DEFAULT_ABILITY);
  const [cha, setCha] = useState(DEFAULT_ABILITY);

  // Details
  const [showDetails, setShowDetails] = useState(false);
  const [saves, setSaves] = useState('');
  const [skills, setSkills] = useState('');
  const [resistances, setResistances] = useState('');
  const [immunities, setImmunities] = useState('');
  const [vulnerabilities, setVulnerabilities] = useState('');
  const [conditionImmunities, setConditionImmunities] = useState('');
  const [senses, setSenses] = useState('');
  const [languages, setLanguages] = useState('');
  const [cr, setCr] = useState('');

  // Traits / Actions / Bonus Actions / Reactions / Lair Actions
  const [traits, setTraits] = useState<NamedText[]>([]);
  const [actions, setActions] = useState<NamedText[]>([]);
  const [bonusActions, setBonusActions] = useState<NamedText[]>([]);
  const [reactions, setReactions] = useState<NamedText[]>([]);
  const [lairActions, setLairActions] = useState<NamedText[]>([]);

  // Lore
  const [showLore, setShowLore] = useState(false);
  const [loreHtml, setLoreHtml] = useState('');

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
      setShowLore(!!editingNpc.loreHtml);

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
        const hasDetails =
          sb.saves ||
          sb.skills ||
          sb.resistances ||
          sb.immunities ||
          sb.vulnerabilities ||
          sb.conditionImmunities?.length ||
          sb.senses ||
          sb.languages ||
          sb.cr;
        setShowDetails(!!hasDetails);
      } else if (editingNpc.abilityScores) {
        setStr(editingNpc.abilityScores.str);
        setDex(editingNpc.abilityScores.dex);
        setCon(editingNpc.abilityScores.con);
        setInt(editingNpc.abilityScores.int);
        setWis(editingNpc.abilityScores.wis);
        setCha(editingNpc.abilityScores.cha);
        resetDetailFields();
      } else {
        resetAbilityScores();
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
    setShowDetails(false);
    setTraits([]);
    setActions([]);
    setBonusActions([]);
    setReactions([]);
    setLairActions([]);
  }

  function resetAll() {
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
    setShowLore(false);
    setBestiaryQuery('');
    setBestiaryResults([]);
    resetAbilityScores();
    resetDetailFields();
  }

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
    setTraits(sb.traits.map(t => ({ ...t })));
    setActions(sb.actions.map(a => ({ ...a })));
    setBonusActions(sb.bonusActions.map(b => ({ ...b })));
    setReactions(sb.reactions.map(r => ({ ...r })));
    setLairActions([]);
    setBestiarySourceId(monster.id);
    setBestiarySourceName(monster.name);
    setBestiaryQuery('');
    setBestiaryResults([]);

    const hasDetails =
      sb.saves ||
      sb.skills ||
      sb.resistances ||
      sb.immunities ||
      sb.vulnerabilities ||
      sb.conditionImmunities.length > 0 ||
      sb.senses ||
      sb.languages ||
      sb.cr;
    setShowDetails(!!hasDetails);
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

    let monsterStatBlock: MonsterStatBlock | undefined;
    if (
      hasSubstantiveStatBlock(
        scores,
        detailFields,
        traits,
        actions,
        bonusActions,
        reactions,
        lairActions,
        bestiarySourceId
      )
    ) {
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
        passivePerception: 10 + Math.floor((wis - 10) / 2),
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

    onSave({
      name: name.trim(),
      armorClass: ac,
      maxHp: hp,
      speed: speed.trim() || '30 ft.',
      description: description.trim() || undefined,
      monsterStatBlock,
      bestiarySourceId: bestiarySourceId ?? undefined,
      loreHtml: loreHtml.trim() || undefined,
      avatarUrl: avatarUrl || undefined,
    });
    onOpenChange(false);
  };

  // ---------- Render ----------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingNpc ? 'Edit NPC' : 'Create NPC'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-5">
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
                        <span className="flex-1 font-medium">{m.name}</span>
                        <span className="text-muted text-xs">CR {m.cr}</span>
                        <span className="text-faint text-xs">
                          {typeof m.type === 'string' ? m.type : m.type.type}
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
                  {avatarUrl ? 'Portrait uploaded' : 'Click to upload portrait'}
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

            {/* ===== Core Stats ===== */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <SelectField label="Size" value={size} onValueChange={setSize}>
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
              <Input
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                label="Speed"
                placeholder="30 ft., fly 60 ft."
              />
            </div>

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
                          setter as React.Dispatch<React.SetStateAction<number>>
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

            {/* ===== Details (collapsible) ===== */}
            <div>
              <button
                onClick={() => setShowDetails(v => !v)}
                className="text-accent-purple-text flex items-center gap-1 text-sm font-medium hover:underline"
              >
                {showDetails ? (
                  <>
                    <ChevronUp size={14} /> Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Show Details
                  </>
                )}
              </button>
              {showDetails && (
                <div className="mt-2 space-y-2">
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
                  <div className="w-24">
                    <Input
                      value={cr}
                      onChange={e => setCr(e.target.value)}
                      label="CR"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
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

            {/* ===== Lore (collapsible) ===== */}
            <div>
              <button
                onClick={() => setShowLore(v => !v)}
                className="text-accent-purple-text flex items-center gap-1 text-sm font-medium hover:underline"
              >
                {showLore ? (
                  <>
                    <ChevronUp size={14} /> Hide Lore
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} /> Add Lore
                  </>
                )}
              </button>
              {showLore && (
                <div className="mt-2">
                  <CompactRichTextEditor
                    content={loreHtml}
                    onChange={setLoreHtml}
                    placeholder="Write NPC lore, backstory, motivations..."
                    minHeight="120px"
                  />
                </div>
              )}
            </div>

            {/* ===== Footer ===== */}
            <div className="flex justify-end gap-2 pt-2">
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
                disabled={!name.trim()}
              >
                {editingNpc ? 'Save Changes' : 'Create NPC'}
              </Button>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
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

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
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
                <Input
                  value={item.name}
                  onChange={e => handleUpdate(index, 'name', e.target.value)}
                  placeholder={`${label.slice(0, -1)} name`}
                  className="flex-1"
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
