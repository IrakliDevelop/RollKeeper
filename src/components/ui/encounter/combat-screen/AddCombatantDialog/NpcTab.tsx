'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import type {
  CampaignNPC,
  EncounterEntity,
  PlayerDisposition,
} from '@/types/encounter';
import { useNPCStore } from '@/store/npcStore';
import { buildNpcEntity } from './buildEntity';
import { SharedOptions } from './SharedOptions';
import { SavedCreaturePicker } from './SavedCreaturePicker';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';

interface NpcTabProps {
  npcs: CampaignNPC[];
  campaignCode?: string;
  onAdd: (entity: Omit<EncounterEntity, 'id'>) => void;
}

export function NpcTab({ npcs, campaignCode, onAdd }: NpcTabProps) {
  const [creatingNpc, setCreatingNpc] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [npcName, setNpcName] = useState('');
  const [npcHp, setNpcHp] = useState('10');
  const [npcAc, setNpcAc] = useState('10');
  const [npcSpeed, setNpcSpeed] = useState('30 ft.');
  const [npcDescription, setNpcDescription] = useState('');
  const [hideName, setHideName] = useState(false);
  const [playerAlias, setPlayerAlias] = useState('');
  const [disposition, setDisposition] = useState<PlayerDisposition>('enemy');

  const { createNPC, deleteNPC } = useNPCStore();
  // Subscribe to the campaign's list itself so deletes and new NPCs show up
  // while the tab is open. No `?? []` here: a fresh array would re-render forever.
  const campaignNpcs = useNPCStore(state =>
    campaignCode ? state.npcsByCampaign[campaignCode] : undefined
  );
  const allNpcs = useMemo(
    () => (campaignNpcs ?? npcs).filter(npc => (npc.kind ?? 'npc') === 'npc'),
    [campaignNpcs, npcs]
  );

  const handleCreateNpc = () => {
    if (!npcName.trim() || !campaignCode) return;
    createNPC(campaignCode, {
      name: npcName.trim(),
      kind: 'npc',
      maxHp: parseInt(npcHp) || 10,
      armorClass: npcAc.trim() || '10',
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

  const handleAddNpc = (npc: CampaignNPC) => {
    onAdd(
      buildNpcEntity(npc, {
        isHidden: hideName,
        playerAlias: playerAlias || undefined,
        playerDisposition: disposition,
        campaignCode,
      })
    );
  };

  const handleDelete = async (npc: CampaignNPC) => {
    if (!campaignCode) return false;
    const confirmed = await confirmDialog({
      title: `Delete ${npc.name}?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete NPC',
      tone: 'danger',
    });
    if (confirmed) deleteNPC(campaignCode, npc.id);
    return confirmed;
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Create NPC toggle / form */}
      {creatingNpc ? (
        <div className="border-divider space-y-3 border-t pt-4">
          <p className="text-heading text-sm font-semibold">Create NPC</p>
          <Input
            value={npcName}
            onChange={e => setNpcName(e.target.value)}
            placeholder="NPC name"
            label="Name"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-3">
            <NumberInput
              value={npcHp === '' ? undefined : Number(npcHp)}
              onChange={value =>
                setNpcHp(value === undefined ? '' : String(value))
              }
              label="HP"
              allowEmpty
              min={0}
            />
            <Input
              value={npcAc}
              onChange={e => setNpcAc(e.target.value)}
              label="AC"
              placeholder="16 (natural armor)"
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
          ref={createButtonRef}
          variant="secondary"
          fullWidth
          onClick={() => setCreatingNpc(true)}
          leftIcon={<Plus size={16} />}
        >
          Create NPC
        </Button>
      )}

      {/* SharedOptions (when not creating) */}
      {!creatingNpc && (
        <SharedOptions
          hideName={hideName}
          onHideNameChange={setHideName}
          playerAlias={playerAlias}
          onPlayerAliasChange={setPlayerAlias}
          disposition={disposition}
          onDispositionChange={setDisposition}
        />
      )}

      {!creatingNpc && (
        <SavedCreaturePicker
          creatures={allNpcs}
          emptyMessage="No NPCs yet. Create one to reuse across encounters."
          onSelect={handleAddNpc}
          onDelete={handleDelete}
          onDeleteFallbackFocus={() => createButtonRef.current?.focus()}
        />
      )}
    </div>
  );
}
