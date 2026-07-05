'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import type { EncounterEntity, CampaignNPC } from '@/types/encounter';
import { PlayerTab } from './PlayerTab';
import { NpcTab } from './NpcTab';
import { MonsterTab } from './MonsterTab';
import { CustomTab } from './CustomTab';

export interface AddCombatantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddEntity: (entity: Omit<EncounterEntity, 'id'>) => void;
  campaignCode: string;
  campaignPlayers: Array<{
    id: string;
    name: string;
    class: string;
    level: number;
    armorClass: number;
    currentHp: number;
    maxHp: number;
    dexterity: number;
  }>;
  npcs: CampaignNPC[];
  playerColors?: Record<string, string>;
}

type Tab = 'player' | 'npc' | 'monster' | 'custom';

interface TabMeta {
  id: Tab;
  label: string;
  dotClass: string;
}

const TABS: TabMeta[] = [
  { id: 'player', label: 'Player', dotClass: 'bg-accent-blue-text' },
  { id: 'npc', label: 'NPC', dotClass: 'bg-accent-amber-text' },
  { id: 'monster', label: 'Monster', dotClass: 'bg-accent-purple-text' },
  { id: 'custom', label: 'Custom', dotClass: 'bg-muted' },
];

export function AddCombatantDialog({
  open,
  onOpenChange,
  onAddEntity,
  campaignCode,
  campaignPlayers,
  npcs,
  playerColors,
}: AddCombatantDialogProps) {
  const [tab, setTab] = useState<Tab>('monster');
  const [monsterColorIdx, setMonsterColorIdx] = useState(0);
  const [resetKey, setResetKey] = useState(0);

  const handleOpenChange = (v: boolean) => {
    if (!v) setResetKey(k => k + 1);
    onOpenChange(v);
  };

  const handleAdd = (entity: Omit<EncounterEntity, 'id'>) => {
    onAddEntity(entity);
    onOpenChange(false);
  };

  const handleAddMultiple = (entities: Array<Omit<EncounterEntity, 'id'>>) => {
    for (const entity of entities) onAddEntity(entity);
    setMonsterColorIdx(i => i + 1);
    onOpenChange(false);
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setResetKey(k => k + 1);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-surface-secondary flex h-[min(660px,92vh)] max-h-none w-[min(640px,94vw)] flex-col gap-0 overflow-hidden rounded-[20px] p-0"
      >
        {/* Accessible title (visually hidden — custom heading below) */}
        <DialogTitle className="sr-only">Add Combatant</DialogTitle>

        {/* Header */}
        <div className="shrink-0 px-6 pt-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-accent-amber-text-muted mb-0.5 text-[10px] font-extrabold tracking-[0.12em] uppercase">
                Encounter Roster
              </p>
              <h2 className="font-display text-heading text-2xl font-extrabold tracking-tight">
                Add Combatant
              </h2>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="border-divider bg-surface-raised text-muted hover:text-heading mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="bg-surface-inset mt-4 mb-0 flex gap-[3px] rounded-[12px] p-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => handleTabChange(t.id)}
                className={`flex flex-1 items-center justify-center gap-[7px] rounded-[9px] px-1.5 py-[9px] text-[13.5px] font-bold transition-all ${
                  tab === t.id
                    ? 'bg-surface-raised text-heading shadow-sm'
                    : 'text-muted'
                }`}
              >
                <span
                  className={`h-[7px] w-[7px] shrink-0 rounded-full ${t.dotClass} ${tab === t.id ? 'opacity-100' : 'opacity-50'}`}
                />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pt-[18px]">
          {tab === 'player' && (
            <PlayerTab
              key={`player-${resetKey}`}
              players={campaignPlayers}
              playerColors={playerColors}
              campaignCode={campaignCode}
              onAdd={handleAdd}
            />
          )}
          {tab === 'npc' && (
            <NpcTab
              key={`npc-${resetKey}`}
              npcs={npcs}
              campaignCode={campaignCode}
              onAdd={handleAdd}
            />
          )}
          {tab === 'monster' && (
            <MonsterTab
              key={`monster-${resetKey}`}
              colorIdx={monsterColorIdx}
              onAdd={handleAddMultiple}
            />
          )}
          {tab === 'custom' && (
            <CustomTab key={`custom-${resetKey}`} onAdd={handleAdd} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
