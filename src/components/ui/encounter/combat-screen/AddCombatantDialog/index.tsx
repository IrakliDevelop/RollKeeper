'use client';

import React, { useId, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { SubTabs, type SubTabDefinition } from '@/components/ui/layout/SubTabs';
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
import {
  buildMonsterEntities,
  buildCustomEntity,
  buildNpcEntity,
} from './buildEntity';
import {
  createCustomEditDraft,
  createMonsterEditDraft,
  setDraftInitiative,
} from './monsterEditDraft';
import type { MonsterEditDraft } from './monsterEditDraft';
import { StatBlockEditor } from './StatBlockEditor';

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
    avatarUrl?: string;
    shareHpWithParty?: boolean;
  }>;
  npcs: CampaignNPC[];
  playerColors?: Record<string, string>;
}

type Tab = 'player' | 'npc' | 'monster' | 'custom';

export function AddCombatantDialog({
  open,
  onOpenChange,
  onAddEntity,
  campaignCode,
  campaignPlayers,
  npcs,
  playerColors,
}: AddCombatantDialogProps) {
  const tabId = useId();
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
  const [cDraft, setCDraft] = useState<MonsterEditDraft | null>(null);
  const [cEditing, setCEditing] = useState(false);
  const customMonsters = useMemo(
    () => npcs.filter(npc => npc.kind === 'monster'),
    [npcs]
  );

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
    setCDraft(null);
    setCEditing(false);
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
        initMod: cDraft?.initiativeModifier ?? (parseInt(cInit) || 0),
        isHidden: cHideName,
        playerAlias: cAlias || undefined,
        playerDisposition: cDisposition,
        statBlock: cDraft?.statBlock,
        proficiencyBonus: cDraft?.proficiencyBonus,
      })
    );
  };

  const handleSavedMonsterAdd = (monster: CampaignNPC) => {
    handleAdd(
      buildNpcEntity(monster, {
        isHidden: cHideName,
        playerAlias: cAlias || undefined,
        playerDisposition: cDisposition,
        campaignCode,
      })
    );
  };

  const handleCustomInitChange = (value: string) => {
    setCInit(value);
    if (cDraft) {
      setCDraft(setDraftInitiative(cDraft, parseInt(value) || 0));
    }
  };

  const handleCustomEditStatBlock = () => {
    setCDraft(d => d ?? createCustomEditDraft(parseInt(cInit) || 0));
    setCEditing(true);
  };

  const handleCustomDraftChange = (draft: MonsterEditDraft) => {
    setCDraft(draft);
    setCInit(String(draft.initiativeModifier));
  };

  const showFooter =
    (tab === 'monster' && selMonster !== null) || tab === 'custom';

  const tabs: SubTabDefinition[] = [
    {
      value: 'player',
      id: `${tabId}-player`,
      label: 'Player',
      content: (
        <PlayerTab
          players={campaignPlayers}
          playerColors={playerColors}
          campaignCode={campaignCode}
          onAdd={handleAdd}
        />
      ),
    },
    {
      value: 'npc',
      id: `${tabId}-npc`,
      label: 'NPC',
      content: (
        <NpcTab npcs={npcs} campaignCode={campaignCode} onAdd={handleAdd} />
      ),
    },
    {
      value: 'monster',
      id: `${tabId}-monster`,
      label: 'Monster',
      content: (
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
      ),
    },
    {
      value: 'custom',
      id: `${tabId}-custom`,
      label: 'Custom',
      content:
        cEditing && cDraft ? (
          <StatBlockEditor
            monsterName={cName.trim() || 'custom combatant'}
            draft={cDraft}
            onDraftChange={handleCustomDraftChange}
            onReset={() =>
              setCDraft(createCustomEditDraft(parseInt(cInit) || 0))
            }
            onBack={() => setCEditing(false)}
            resetLabel="Reset stat block"
          />
        ) : (
          <CustomTab
            customMonsters={customMonsters}
            onAddSavedMonster={handleSavedMonsterAdd}
            name={cName}
            onNameChange={setCName}
            type={cType}
            onTypeChange={setCType}
            hp={cHp}
            onHpChange={setCHp}
            ac={cAc}
            onAcChange={setCAc}
            initMod={cInit}
            onInitModChange={handleCustomInitChange}
            hideName={cHideName}
            onHideNameChange={setCHideName}
            playerAlias={cAlias}
            onPlayerAliasChange={setCAlias}
            disposition={cDisposition}
            onDispositionChange={setCDisposition}
            onEditStatBlock={handleCustomEditStatBlock}
            hasStatBlockEdits={cDraft !== null}
          />
        ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[min(660px,92vh)] w-[min(640px,94vw)] flex-col gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogTitle className="shrink-0 px-5 pt-5 pr-16">
          Add combatant
        </DialogTitle>
        <div className="flex min-h-0 flex-1 flex-col px-5">
          <SubTabs
            tabs={tabs}
            label="Combatant type"
            value={tab}
            onValueChange={value => {
              if (
                value === 'player' ||
                value === 'npc' ||
                value === 'monster' ||
                value === 'custom'
              ) {
                handleTabChange(value);
              }
            }}
            className="flex min-h-0 flex-1 flex-col"
            contentClassName="min-h-0 flex-1 overflow-y-auto pb-4"
          />
        </div>
        {showFooter && (
          <div
            className="border-divider shrink-0 border-t px-5 py-4"
            data-testid="dialog-footer"
          >
            {tab === 'monster' && selMonster && (
              <Button
                variant="primary"
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
                variant="primary"
                fullWidth
                onClick={handleCustomAdd}
                disabled={!cName.trim()}
                leftIcon={<Plus size={16} />}
              >
                Add {cType === 'npc' ? 'NPC' : 'monster'}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
