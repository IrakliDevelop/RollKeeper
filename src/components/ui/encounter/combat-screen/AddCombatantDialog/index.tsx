'use client';

import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import type {
  EncounterEntity,
  CampaignNPC,
  PlayerDisposition,
} from '@/types/encounter';
import type { ProcessedMonster } from '@/types/bestiary';
import { PlayerTab } from './PlayerTab';
import { NpcTab } from './NpcTab';
import { MonsterTab } from './MonsterTab';
import { CustomTab } from './CustomTab';
import { buildMonsterEntities, buildCustomEntity } from './buildEntity';
import { createMonsterEditDraft } from './monsterEditDraft';
import type { MonsterEditDraft } from './monsterEditDraft';

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

  // Monster detail state (lifted for anchored footer)
  const [selMonster, setSelMonster] = useState<ProcessedMonster | null>(null);
  const [mHp, setMHp] = useState('');
  const [mAc, setMAc] = useState('');
  const [mCount, setMCount] = useState(1);
  const [mHideName, setMHideName] = useState(false);
  const [mAlias, setMAlias] = useState('');
  const [mDisposition, setMDisposition] = useState<PlayerDisposition>('enemy');
  const [mDraft, setMDraft] = useState<MonsterEditDraft | null>(null);
  const [mEditing, setMEditing] = useState(false);

  // Custom form state (lifted for anchored footer)
  const [cName, setCName] = useState('');
  const [cType, setCType] = useState<'npc' | 'monster'>('npc');
  const [cHp, setCHp] = useState('10');
  const [cAc, setCAc] = useState('10');
  const [cInit, setCInit] = useState('0');
  const [cHideName, setCHideName] = useState(false);
  const [cAlias, setCAlias] = useState('');
  const [cDisposition, setCDisposition] = useState<PlayerDisposition>('enemy');

  const resetMonsterState = () => {
    setSelMonster(null);
    setMHp('');
    setMAc('');
    setMCount(1);
    setMHideName(false);
    setMAlias('');
    setMDisposition('enemy');
    setMDraft(null);
    setMEditing(false);
  };

  const resetCustomState = () => {
    setCName('');
    setCType('npc');
    setCHp('10');
    setCAc('10');
    setCInit('0');
    setCHideName(false);
    setCAlias('');
    setCDisposition('enemy');
  };

  // Selecting a (different) monster always discards any stat block draft.
  const handleMonsterSelect = (m: ProcessedMonster | null) => {
    setSelMonster(m);
    setMDraft(null);
    setMEditing(false);
  };

  const handleEditStatBlock = () => {
    if (!selMonster) return;
    setMDraft(d => d ?? createMonsterEditDraft(selMonster));
    setMEditing(true);
  };

  const handleResetDraft = () => {
    if (!selMonster) return;
    setMDraft(createMonsterEditDraft(selMonster));
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      resetMonsterState();
      resetCustomState();
    }
    onOpenChange(v);
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    resetMonsterState();
    resetCustomState();
  };

  const handleAdd = (entity: Omit<EncounterEntity, 'id'>) => {
    onAddEntity(entity);
    handleOpenChange(false);
  };

  const handleAddMultiple = (entities: Array<Omit<EncounterEntity, 'id'>>) => {
    for (const entity of entities) onAddEntity(entity);
    setMonsterColorIdx(i => i + 1);
    handleOpenChange(false);
  };

  const handleMonsterAdd = () => {
    if (!selMonster) return;
    handleAddMultiple(
      buildMonsterEntities(selMonster, {
        count: mCount,
        hpOverride: parseInt(mHp) || selMonster.hpAverage,
        acOverride: parseInt(mAc) || selMonster.acValue,
        isHidden: mHideName,
        playerAlias: mAlias || undefined,
        playerDisposition: mDisposition,
        colorIdx: monsterColorIdx,
        statBlockOverride: mDraft?.statBlock,
        initiativeModifierOverride: mDraft?.initiativeModifier,
        proficiencyBonusOverride: mDraft?.proficiencyBonus,
      })
    );
  };

  const handleCustomAdd = () => {
    if (!cName.trim()) return;
    handleAdd(
      buildCustomEntity({
        name: cName,
        type: cType,
        hp: parseInt(cHp) || 10,
        ac: parseInt(cAc) || 10,
        initMod: parseInt(cInit) || 0,
        isHidden: cHideName,
        playerAlias: cAlias || undefined,
        playerDisposition: cDisposition,
      })
    );
  };

  const showFooter =
    (tab === 'monster' && selMonster !== null) || tab === 'custom';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bg-surface-secondary flex h-[min(660px,92vh)] max-h-none w-[min(640px,94vw)] flex-col gap-0 overflow-hidden rounded-[20px] p-0"
      >
        {/* Accessible title (visually hidden — custom heading below) */}
        <DialogTitle className="sr-only">Add Combatant</DialogTitle>

        {/* Header — anchored */}
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
              onClick={() => handleOpenChange(false)}
              aria-label="Close"
              className="border-divider bg-surface-raised text-muted hover:text-heading mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Tab bar — anchored */}
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

        {/* Scrollable body — only this region scrolls */}
        <div
          className="flex-1 overflow-y-auto px-6 pt-[18px]"
          data-testid="dialog-body"
        >
          {tab === 'player' && (
            <PlayerTab
              players={campaignPlayers}
              playerColors={playerColors}
              campaignCode={campaignCode}
              onAdd={handleAdd}
            />
          )}
          {tab === 'npc' && (
            <NpcTab npcs={npcs} campaignCode={campaignCode} onAdd={handleAdd} />
          )}
          {tab === 'monster' && (
            <MonsterTab
              selected={selMonster}
              onSelect={handleMonsterSelect}
              hp={mHp}
              onHpChange={setMHp}
              ac={mAc}
              onAcChange={setMAc}
              count={mCount}
              onCountChange={setMCount}
              hideName={mHideName}
              onHideNameChange={setMHideName}
              playerAlias={mAlias}
              onPlayerAliasChange={setMAlias}
              disposition={mDisposition}
              onDispositionChange={setMDisposition}
              draft={mDraft}
              editing={mEditing}
              onEditStatBlock={handleEditStatBlock}
              onDraftChange={setMDraft}
              onEditorBack={() => setMEditing(false)}
              onEditorReset={handleResetDraft}
            />
          )}
          {tab === 'custom' && (
            <CustomTab
              name={cName}
              onNameChange={setCName}
              type={cType}
              onTypeChange={setCType}
              hp={cHp}
              onHpChange={setCHp}
              ac={cAc}
              onAcChange={setCAc}
              initMod={cInit}
              onInitModChange={setCInit}
              hideName={cHideName}
              onHideNameChange={setCHideName}
              playerAlias={cAlias}
              onPlayerAliasChange={setCAlias}
              disposition={cDisposition}
              onDispositionChange={setCDisposition}
            />
          )}
        </div>

        {/* Anchored footer — shown only for monster (with selection) and custom */}
        {showFooter && (
          <div
            className="border-divider shrink-0 border-t px-6 pt-3.5 pb-4"
            data-testid="dialog-footer"
          >
            {tab === 'monster' && selMonster && (
              <Button
                variant="success"
                fullWidth
                onClick={handleMonsterAdd}
                leftIcon={<Plus size={16} />}
              >
                Add {selMonster.name}
                {mCount > 1 ? ` ×${mCount}` : ''}
              </Button>
            )}
            {tab === 'custom' && (
              <Button
                variant="success"
                fullWidth
                onClick={handleCustomAdd}
                disabled={!cName.trim()}
                leftIcon={<Plus size={16} />}
              >
                Add {cType === 'npc' ? 'NPC' : 'Monster'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
