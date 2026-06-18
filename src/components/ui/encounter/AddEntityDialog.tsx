'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  ShieldUser,
  CircleUserRound,
  ContactRound,
  Drama,
  Trash2,
  ArrowLeft,
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
import { Checkbox } from '@/components/ui/forms/checkbox';
import {
  EncounterEntity,
  CampaignNPC,
  PlayerDisposition,
} from '@/types/encounter';
import { ProcessedMonster } from '@/types/bestiary';
import type { Spell } from '@/types/character';
import { useNPCStore } from '@/store/npcStore';
import {
  monsterToEncounterEntity,
  buildAbilitiesFromStatBlock,
} from '@/utils/encounterConverter';
import {
  getNPCSpellSlots,
  calculateNPCSpellAttack,
  calculateNPCSpellDC,
  getNPCSpellcastingAbilityScore,
  getProficiencyBonusFromCR,
} from '@/utils/npcSpellcasting';

interface AddEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddEntity: (entity: Omit<EncounterEntity, 'id'>) => void;
  campaignCode?: string;
  campaignPlayers?: Array<{
    id: string;
    name: string;
    class: string;
    level: number;
    armorClass: number;
    currentHp: number;
    maxHp: number;
    dexterity: number;
  }>;
  npcs?: CampaignNPC[];
  playerColors?: Record<string, string>;
}

type Tab = 'player' | 'monster' | 'npc' | 'custom';

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'player', label: 'Player', icon: <ShieldUser size={14} /> },
  { id: 'npc', label: 'NPC', icon: <CircleUserRound size={14} /> },
  { id: 'monster', label: 'Monster', icon: <ContactRound size={14} /> },
  { id: 'custom', label: 'Custom', icon: <Drama size={14} /> },
];

function buildPerDayMap(spells: Spell[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const spell of spells) {
    if (spell.freeCastMax && spell.freeCastMax > 0) {
      const key = String(spell.freeCastMax);
      if (!map[key]) map[key] = [];
      map[key].push(spell.name);
    }
  }
  return map;
}

function buildSlotMap(
  slots: Record<number, number>,
  slotsUsed: Record<number, number>
): Record<string, { max: number; used: number }> {
  const map: Record<string, { max: number; used: number }> = {};
  for (const [level, max] of Object.entries(slots)) {
    if (max > 0) {
      map[String(level)] = { max, used: slotsUsed[Number(level)] ?? 0 };
    }
  }
  return map;
}

function buildUsedSpellsMap(spells: Spell[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const spell of spells) {
    if (spell.freeCastMax && spell.freeCastMax > 0 && spell.freeCastsUsed) {
      map[spell.name] = spell.freeCastsUsed;
    }
  }
  return map;
}

// Monster group colors for distinguishing multiples of the same type
const GROUP_COLORS = [
  '#ef4444', // red
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

const DISPOSITION_OPTIONS: Array<{
  value: PlayerDisposition;
  label: string;
  title: string;
  activeClass: string;
}> = [
  {
    value: 'ally',
    label: 'Ally',
    title: 'Players see this as an ally',
    activeClass: 'bg-surface-raised text-accent-emerald-text shadow-sm',
  },
  {
    value: 'enemy',
    label: 'Enemy',
    title: 'Players see this as an enemy',
    activeClass: 'bg-surface-raised text-accent-red-text shadow-sm',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    title: 'Players see this as neutral',
    activeClass: 'bg-surface-raised text-muted shadow-sm',
  },
];

function DispositionToggle({
  value,
  onChange,
}: {
  value: PlayerDisposition;
  onChange: (v: PlayerDisposition) => void;
}) {
  return (
    <div>
      <label className="text-body mb-1 block text-sm">Player sees as</label>
      <div className="bg-surface-secondary inline-flex rounded-lg p-0.5">
        {DISPOSITION_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              value === opt.value
                ? opt.activeClass
                : 'text-muted hover:text-body'
            }`}
            title={opt.title}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AddEntityDialog({
  open,
  onOpenChange,
  onAddEntity,
  campaignCode,
  campaignPlayers = [],
  npcs = [],
  playerColors,
}: AddEntityDialogProps) {
  const [activeTab, setActiveTab] = useState<Tab>('monster');
  const [monsterSearch, setMonsterSearch] = useState('');
  const [monsterResults, setMonsterResults] = useState<ProcessedMonster[]>([]);
  const [monsterLoading, setMonsterLoading] = useState(false);
  const [monsterCount, setMonsterCount] = useState(1);
  const [selectedMonsterColorIdx, setSelectedMonsterColorIdx] = useState(0);

  // Monster customization step
  const [selectedMonster, setSelectedMonster] =
    useState<ProcessedMonster | null>(null);
  const [customizeHp, setCustomizeHp] = useState('');
  const [customizeAc, setCustomizeAc] = useState('');
  const [monsterHideFromPlayers, setMonsterHideFromPlayers] = useState(false);
  const [monsterPlayerAlias, setMonsterPlayerAlias] = useState('');

  // NPC creation form
  const [creatingNpc, setCreatingNpc] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [npcHp, setNpcHp] = useState('10');
  const [npcAc, setNpcAc] = useState('10');
  const [npcSpeed, setNpcSpeed] = useState('30 ft.');
  const [npcDescription, setNpcDescription] = useState('');

  const { getNPCsForCampaign, createNPC, deleteNPC } = useNPCStore();
  const storedNpcs = campaignCode ? getNPCsForCampaign(campaignCode) : [];
  const allNpcs = [
    ...npcs,
    ...storedNpcs.filter(sn => !npcs.some(n => n.id === sn.id)),
  ];

  // Custom entity form
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState<'npc' | 'monster'>('npc');
  const [customHp, setCustomHp] = useState('10');
  const [customAc, setCustomAc] = useState('10');
  const [customInitMod, setCustomInitMod] = useState('0');
  const [customHideFromPlayers, setCustomHideFromPlayers] = useState(false);
  const [customPlayerAlias, setCustomPlayerAlias] = useState('');

  // NPC add-to-encounter form (per-NPC hide/alias when clicking "Add" on an existing NPC)
  const [npcHideFromPlayers, setNpcHideFromPlayers] = useState(false);
  const [npcPlayerAlias, setNpcPlayerAlias] = useState('');
  const [npcDisposition, setNpcDisposition] =
    useState<PlayerDisposition>('enemy');
  const [monsterDisposition, setMonsterDisposition] =
    useState<PlayerDisposition>('enemy');
  const [customDisposition, setCustomDisposition] =
    useState<PlayerDisposition>('enemy');

  const searchMonsters = useCallback(async (query: string) => {
    if (query.length < 2) {
      setMonsterResults([]);
      return;
    }
    setMonsterLoading(true);
    try {
      const res = await fetch(
        `/api/bestiary/search?q=${encodeURIComponent(query)}&limit=20`
      );
      if (res.ok) {
        const data = await res.json();
        setMonsterResults(data.monsters ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setMonsterLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => searchMonsters(monsterSearch), 300);
    return () => clearTimeout(timeout);
  }, [monsterSearch, searchMonsters]);

  // Reset hide/alias fields when the dialog closes so a previous, unsubmitted
  // choice doesn't leak into the next time it's opened.
  useEffect(() => {
    if (!open) {
      setMonsterHideFromPlayers(false);
      setMonsterPlayerAlias('');
      setMonsterDisposition('enemy');
      setNpcHideFromPlayers(false);
      setNpcPlayerAlias('');
      setNpcDisposition('enemy');
      setCustomHideFromPlayers(false);
      setCustomPlayerAlias('');
      setCustomDisposition('enemy');
    }
  }, [open]);

  const handleSelectMonster = (monster: ProcessedMonster) => {
    setSelectedMonster(monster);
    setCustomizeHp(monster.hpAverage.toString());
    setCustomizeAc(monster.acValue.toString());
  };

  const handleConfirmAddMonster = () => {
    if (!selectedMonster) return;
    const color = GROUP_COLORS[selectedMonsterColorIdx % GROUP_COLORS.length];
    const hpOverride = parseInt(customizeHp) || undefined;
    const acOverride = parseInt(customizeAc) || undefined;
    const aliasValue = monsterPlayerAlias.trim() || undefined;

    for (let i = 0; i < monsterCount; i++) {
      const suffix = monsterCount > 1 ? ` ${String.fromCharCode(65 + i)}` : '';
      const entity = monsterToEncounterEntity(selectedMonster, {
        nameOverride: `${selectedMonster.name}${suffix}`,
        color,
        hpOverride:
          hpOverride !== selectedMonster.hpAverage ? hpOverride : undefined,
        acOverride:
          acOverride !== selectedMonster.acValue ? acOverride : undefined,
      });
      onAddEntity({
        ...entity,
        isHidden: monsterHideFromPlayers,
        playerAlias: aliasValue,
        playerDisposition: monsterDisposition,
      });
    }

    setSelectedMonsterColorIdx(prev => prev + 1);
    setMonsterCount(1);
    setSelectedMonster(null);
    setMonsterHideFromPlayers(false);
    setMonsterPlayerAlias('');
    setMonsterDisposition('enemy');
  };

  const handleAddPlayer = (player: (typeof campaignPlayers)[number]) => {
    onAddEntity({
      type: 'player',
      name: player.name,
      initiative: null,
      initiativeModifier: Math.floor((player.dexterity - 10) / 2),
      currentHp: player.currentHp,
      maxHp: player.maxHp,
      tempHp: 0,
      armorClass: player.armorClass,
      conditions: [],
      playerCharacterId: player.id,
      campaignCode,
      isHidden: false,
      color: playerColors?.[player.id],
    });
  };

  const handleAddNpc = (npc: CampaignNPC) => {
    const abilities = npc.monsterStatBlock
      ? buildAbilitiesFromStatBlock(npc.monsterStatBlock)
      : [];

    onAddEntity({
      type: 'npc',
      name: npc.name,
      initiative: null,
      initiativeModifier:
        npc.initiativeModifier != null
          ? npc.initiativeModifier
          : npc.monsterStatBlock
            ? Math.floor((npc.monsterStatBlock.dex - 10) / 2)
            : npc.abilityScores
              ? Math.floor((npc.abilityScores.dex - 10) / 2)
              : 0,
      currentHp: npc.currentHp ?? npc.maxHp,
      maxHp: npc.maxHp,
      tempHp: 0,
      armorClass: npc.armorClass,
      conditions: [],
      isHidden: npcHideFromPlayers,
      playerAlias: npcPlayerAlias.trim() || undefined,
      playerDisposition: npcDisposition,
      monsterStatBlock: npc.monsterStatBlock,
      abilities,
      hitDice: npc.hitDice ? { ...npc.hitDice } : undefined,
      npcSourceId: npc.id,
      campaignCode: campaignCode,
      spellcasting: npc.spellcasting
        ? (() => {
            const abilityScores = npc.monsterStatBlock ?? npc.abilityScores;
            const abilityScore = abilityScores
              ? getNPCSpellcastingAbilityScore(
                  npc.spellcasting!.ability,
                  abilityScores as Parameters<
                    typeof getNPCSpellcastingAbilityScore
                  >[1]
                )
              : 10;
            const profBonus = npc.monsterStatBlock
              ? getProficiencyBonusFromCR(npc.monsterStatBlock.cr)
              : (npc.proficiencyBonus ?? 2);

            const slots = getNPCSpellSlots(
              npc.spellcasting!.casterLevel,
              npc.spellcasting!.slotOverrides
            );

            return {
              ability: npc.spellcasting!.ability,
              dc: calculateNPCSpellDC(
                npc.spellcasting!,
                abilityScore,
                profBonus
              ),
              toHit: calculateNPCSpellAttack(
                npc.spellcasting!,
                abilityScore,
                profBonus
              ),
              atWill: npc
                .spellcasting!.spells.filter(s => s.freeCastMax === 0)
                .map(s => s.name),
              perDay: buildPerDayMap(npc.spellcasting!.spells),
              slots: buildSlotMap(slots, npc.spellcasting!.slotsUsed),
              usedSpells: buildUsedSpellsMap(npc.spellcasting!.spells),
            };
          })()
        : undefined,
    });
    setNpcHideFromPlayers(false);
    setNpcPlayerAlias('');
    setNpcDisposition('enemy');
  };

  const handleCreateNpc = () => {
    if (!npcName.trim() || !campaignCode) return;
    createNPC(campaignCode, {
      name: npcName.trim(),
      maxHp: parseInt(npcHp) || 10,
      armorClass: parseInt(npcAc) || 10,
      speed: npcSpeed.trim() || '30 ft.',
      description: npcDescription.trim() || undefined,
    });
    setNpcName('');
    setNpcHp('10');
    setNpcAc('10');
    setNpcSpeed('30 ft.');
    setNpcDescription('');
    setCreatingNpc(false);
  };

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    onAddEntity({
      type: customType,
      name: customName.trim(),
      initiative: null,
      initiativeModifier: parseInt(customInitMod) || 0,
      currentHp: parseInt(customHp) || 1,
      maxHp: parseInt(customHp) || 1,
      tempHp: 0,
      armorClass: parseInt(customAc) || 10,
      conditions: [],
      isHidden: customHideFromPlayers,
      playerAlias: customPlayerAlias.trim() || undefined,
      playerDisposition: customDisposition,
    });
    setCustomName('');
    setCustomHp('10');
    setCustomAc('10');
    setCustomInitMod('0');
    setCustomHideFromPlayers(false);
    setCustomPlayerAlias('');
    setCustomDisposition('enemy');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Combatant</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {/* Tab buttons */}
          <div className="bg-surface-secondary mb-4 flex rounded-lg p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-surface-raised text-heading shadow-sm'
                    : 'text-muted hover:text-body'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[340px]">
            {/* Monster search + customize */}
            {activeTab === 'monster' && (
              <div className="space-y-3">
                {selectedMonster ? (
                  /* Monster customization step */
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setSelectedMonster(null);
                        setMonsterHideFromPlayers(false);
                        setMonsterPlayerAlias('');
                      }}
                      className="text-muted hover:text-body flex items-center gap-1 text-sm transition-colors"
                    >
                      <ArrowLeft size={14} />
                      Back to search
                    </button>
                    <div className="border-accent-purple-border-strong bg-surface-raised rounded-lg border-2 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-heading font-semibold">
                          {selectedMonster.name}
                        </h4>
                        <span className="text-muted text-xs">
                          CR {selectedMonster.cr}
                        </span>
                      </div>
                      <p className="text-muted mb-3 text-xs">
                        {selectedMonster.size.join('/')}{' '}
                        {typeof selectedMonster.type === 'string'
                          ? selectedMonster.type
                          : selectedMonster.type.type}
                        {selectedMonster.alignment
                          ? `, ${selectedMonster.alignment}`
                          : ''}
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          value={customizeHp}
                          onChange={e => setCustomizeHp(e.target.value)}
                          label="HP"
                          type="number"
                        />
                        <Input
                          value={customizeAc}
                          onChange={e => setCustomizeAc(e.target.value)}
                          label="AC"
                          type="number"
                        />
                        <div>
                          <label className="text-body mb-1 block text-sm">
                            Count
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={monsterCount}
                            onChange={e =>
                              setMonsterCount(
                                Math.max(
                                  1,
                                  Math.min(10, parseInt(e.target.value) || 1)
                                )
                              )
                            }
                            className="bg-surface-secondary text-heading w-full rounded px-2 py-1.5 text-sm"
                          />
                        </div>
                      </div>

                      {/* Ability scores preview */}
                      <div className="mt-3 grid grid-cols-6 gap-1 text-center">
                        {(
                          ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
                        ).map(ability => (
                          <div key={ability}>
                            <span className="text-muted block text-[9px] font-medium uppercase">
                              {ability}
                            </span>
                            <span className="text-body text-xs">
                              {selectedMonster[ability]}
                            </span>
                          </div>
                        ))}
                      </div>

                      <p className="text-faint mt-2 text-[10px]">
                        HP formula: {selectedMonster.hpFormula}
                        {selectedMonster.traits &&
                          selectedMonster.traits.length > 0 &&
                          ` · ${selectedMonster.traits.length} trait(s)`}
                        {selectedMonster.actions &&
                          selectedMonster.actions.length > 0 &&
                          ` · ${selectedMonster.actions.length} action(s)`}
                        {selectedMonster.legendaryActions &&
                          selectedMonster.legendaryActions.length > 0 &&
                          ' · Legendary'}
                      </p>
                    </div>

                    {/* Hide / alias / disposition controls for monster */}
                    <div className="space-y-2">
                      <Checkbox
                        size="sm"
                        checked={monsterHideFromPlayers}
                        onCheckedChange={setMonsterHideFromPlayers}
                        label="Hide name from players"
                      />
                      {(monsterHideFromPlayers || monsterPlayerAlias) && (
                        <Input
                          value={monsterPlayerAlias}
                          onChange={e => setMonsterPlayerAlias(e.target.value)}
                          placeholder="Name players see (optional)"
                          label="Player alias"
                        />
                      )}
                      <DispositionToggle
                        value={monsterDisposition}
                        onChange={setMonsterDisposition}
                      />
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleConfirmAddMonster}
                      leftIcon={<Plus size={16} />}
                      fullWidth
                    >
                      Add {monsterCount > 1 ? `${monsterCount}x ` : ''}
                      {selectedMonster.name}
                    </Button>
                  </div>
                ) : (
                  /* Monster search */
                  <>
                    <Input
                      value={monsterSearch}
                      onChange={e => setMonsterSearch(e.target.value)}
                      placeholder="Search monsters..."
                      leftIcon={<Search size={14} />}
                    />
                    <div className="max-h-72 space-y-1.5 overflow-y-auto">
                      {monsterLoading && (
                        <p className="text-muted py-8 text-center text-sm">
                          Searching...
                        </p>
                      )}
                      {!monsterLoading &&
                        monsterResults.length === 0 &&
                        monsterSearch.length >= 2 && (
                          <p className="text-muted py-8 text-center text-sm">
                            No monsters found
                          </p>
                        )}
                      {monsterResults.map(monster => (
                        <button
                          key={monster.id}
                          onClick={() => handleSelectMonster(monster)}
                          className="border-divider bg-surface-raised hover:border-accent-purple-border hover:bg-accent-purple-bg w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-heading font-semibold">
                              {monster.name}
                            </span>
                            <span className="text-accent-purple-text bg-accent-purple-bg rounded-full px-2 py-0.5 text-xs font-medium">
                              CR {monster.cr}
                            </span>
                          </div>
                          <div className="text-body mt-0.5 text-xs">
                            <span className="font-medium">{monster.hp}</span> HP
                            {' · '}
                            <span className="font-medium">AC {monster.ac}</span>
                            {' · '}
                            {typeof monster.type === 'string'
                              ? monster.type
                              : monster.type.type}
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Players */}
            {activeTab === 'player' && (
              <div className="space-y-1.5">
                {campaignPlayers.length === 0 ? (
                  <p className="text-muted py-8 text-center text-sm">
                    No players available. Link a campaign first or add players
                    manually via Custom tab.
                  </p>
                ) : (
                  campaignPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleAddPlayer(player)}
                      className="border-divider bg-surface-raised hover:border-accent-blue-border hover:bg-accent-blue-bg w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-heading font-semibold">
                          {player.name}
                        </span>
                        <span className="text-accent-blue-text bg-accent-blue-bg rounded-full px-2 py-0.5 text-xs font-medium">
                          Lv{player.level} {player.class}
                        </span>
                      </div>
                      <div className="text-body mt-0.5 text-xs">
                        <span className="font-medium">
                          {player.currentHp}/{player.maxHp}
                        </span>{' '}
                        HP
                        {' · '}
                        <span className="font-medium">
                          AC {player.armorClass}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* NPCs */}
            {activeTab === 'npc' && (
              <div className="space-y-3">
                {creatingNpc ? (
                  <div className="border-accent-amber-border bg-surface-raised space-y-3 rounded-lg border p-3">
                    <p className="text-heading text-sm font-medium">
                      Create Permanent NPC
                    </p>
                    <Input
                      value={npcName}
                      onChange={e => setNpcName(e.target.value)}
                      placeholder="NPC name"
                      label="Name"
                      autoFocus
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        value={npcHp}
                        onChange={e => setNpcHp(e.target.value)}
                        label="HP"
                        type="number"
                      />
                      <Input
                        value={npcAc}
                        onChange={e => setNpcAc(e.target.value)}
                        label="AC"
                        type="number"
                      />
                      <Input
                        value={npcSpeed}
                        onChange={e => setNpcSpeed(e.target.value)}
                        label="Speed"
                      />
                    </div>
                    <Input
                      value={npcDescription}
                      onChange={e => setNpcDescription(e.target.value)}
                      placeholder="Brief description (optional)"
                      label="Description"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleCreateNpc}
                        disabled={!npcName.trim()}
                        leftIcon={<Plus size={14} />}
                      >
                        Save NPC
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCreatingNpc(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCreatingNpc(true)}
                    leftIcon={<Plus size={14} />}
                  >
                    Create New NPC
                  </Button>
                )}

                {/* Hide / alias / disposition options applied when adding any NPC below */}
                {!creatingNpc && (
                  <div className="border-divider space-y-2 rounded-lg border p-2">
                    <Checkbox
                      size="sm"
                      checked={npcHideFromPlayers}
                      onCheckedChange={setNpcHideFromPlayers}
                      label="Hide name from players"
                    />
                    {(npcHideFromPlayers || npcPlayerAlias) && (
                      <Input
                        value={npcPlayerAlias}
                        onChange={e => setNpcPlayerAlias(e.target.value)}
                        placeholder="Name players see (optional)"
                        label="Player alias"
                      />
                    )}
                    <DispositionToggle
                      value={npcDisposition}
                      onChange={setNpcDisposition}
                    />
                  </div>
                )}

                {allNpcs.length === 0 && !creatingNpc ? (
                  <p className="text-muted py-8 text-center text-sm">
                    No NPCs yet. Create one to reuse across encounters.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {allNpcs.map(npc => (
                      <div
                        key={npc.id}
                        className="border-divider bg-surface-raised hover:border-accent-amber-border hover:bg-accent-amber-bg flex items-center rounded-lg border text-sm transition-all"
                      >
                        <button
                          onClick={() => handleAddNpc(npc)}
                          className="flex-1 px-3 py-2.5 text-left"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-heading font-semibold">
                              {npc.name}
                            </span>
                            <span className="text-body text-xs">
                              <span className="font-medium">{npc.maxHp}</span>{' '}
                              HP
                              {' · '}
                              <span className="font-medium">
                                AC {npc.armorClass}
                              </span>
                            </span>
                          </div>
                          {npc.description && (
                            <p className="text-muted mt-0.5 truncate text-xs">
                              {npc.description}
                            </p>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(`Delete "${npc.name}"?`) &&
                              campaignCode
                            )
                              deleteNPC(campaignCode, npc.id);
                          }}
                          className="text-muted hover:text-accent-red-text shrink-0 p-2.5 transition-colors"
                          title="Delete NPC"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom entity */}
            {activeTab === 'custom' && (
              <div className="space-y-3">
                <Input
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="Name"
                  label="Name"
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-body mb-1 block text-sm">Type</label>
                    <div className="bg-surface-secondary inline-flex rounded-lg p-0.5">
                      <button
                        onClick={() => setCustomType('npc')}
                        className={`rounded-md px-3 py-1 text-sm font-medium ${
                          customType === 'npc'
                            ? 'bg-surface-raised text-heading shadow-sm'
                            : 'text-muted'
                        }`}
                      >
                        NPC
                      </button>
                      <button
                        onClick={() => setCustomType('monster')}
                        className={`rounded-md px-3 py-1 text-sm font-medium ${
                          customType === 'monster'
                            ? 'bg-surface-raised text-heading shadow-sm'
                            : 'text-muted'
                        }`}
                      >
                        Monster
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    value={customHp}
                    onChange={e => setCustomHp(e.target.value)}
                    label="HP"
                    type="number"
                  />
                  <Input
                    value={customAc}
                    onChange={e => setCustomAc(e.target.value)}
                    label="AC"
                    type="number"
                  />
                  <Input
                    value={customInitMod}
                    onChange={e => setCustomInitMod(e.target.value)}
                    label="Init Mod"
                    type="number"
                  />
                </div>
                {/* Hide / alias / disposition controls for custom entity */}
                <div className="space-y-2">
                  <Checkbox
                    size="sm"
                    checked={customHideFromPlayers}
                    onCheckedChange={setCustomHideFromPlayers}
                    label="Hide name from players"
                  />
                  {(customHideFromPlayers || customPlayerAlias) && (
                    <Input
                      value={customPlayerAlias}
                      onChange={e => setCustomPlayerAlias(e.target.value)}
                      placeholder="Name players see (optional)"
                      label="Player alias"
                    />
                  )}
                  <DispositionToggle
                    value={customDisposition}
                    onChange={setCustomDisposition}
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={handleAddCustom}
                  disabled={!customName.trim()}
                  leftIcon={<Plus size={16} />}
                  fullWidth
                >
                  Add {customType === 'npc' ? 'NPC' : 'Monster'}
                </Button>
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
