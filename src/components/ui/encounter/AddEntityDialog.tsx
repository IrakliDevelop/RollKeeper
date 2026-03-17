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
import { EncounterEntity, CampaignNPC } from '@/types/encounter';
import { ProcessedMonster } from '@/types/bestiary';
import { useNPCStore } from '@/store/npcStore';
import { monsterToEncounterEntity } from '@/utils/encounterConverter';

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

  // NPC creation form
  const [creatingNpc, setCreatingNpc] = useState(false);
  const [npcName, setNpcName] = useState('');
  const [npcHp, setNpcHp] = useState('10');
  const [npcAc, setNpcAc] = useState('10');
  const [npcSpeed, setNpcSpeed] = useState('30 ft.');
  const [npcDescription, setNpcDescription] = useState('');

  const { npcs: storedNpcs, createNPC, deleteNPC } = useNPCStore();
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
      onAddEntity(entity);
    }

    setSelectedMonsterColorIdx(prev => prev + 1);
    setMonsterCount(1);
    setSelectedMonster(null);
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
    onAddEntity({
      type: 'npc',
      name: npc.name,
      initiative: null,
      initiativeModifier: npc.abilityScores
        ? Math.floor((npc.abilityScores.dex - 10) / 2)
        : 0,
      currentHp: npc.maxHp,
      maxHp: npc.maxHp,
      tempHp: 0,
      armorClass: npc.armorClass,
      conditions: [],
      isHidden: false,
    });
  };

  const handleCreateNpc = () => {
    if (!npcName.trim()) return;
    createNPC({
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
      isHidden: false,
    });
    setCustomName('');
    setCustomHp('10');
    setCustomAc('10');
    setCustomInitMod('0');
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
                      onClick={() => setSelectedMonster(null)}
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
                            if (confirm(`Delete "${npc.name}"?`))
                              deleteNPC(npc.id);
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
