'use client';

import React from 'react';
import { FilePen } from 'lucide-react';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Input } from '@/components/ui/forms/input';
import { Button } from '@/components/ui/forms/button';
import type { CampaignNPC, PlayerDisposition } from '@/types/encounter';
import { SharedOptions } from './SharedOptions';
import { SavedCreaturePicker } from './SavedCreaturePicker';

interface CustomTabProps {
  customMonsters: CampaignNPC[];
  onAddSavedMonster: (monster: CampaignNPC) => void;
  name: string;
  onNameChange: (v: string) => void;
  type: 'npc' | 'monster';
  onTypeChange: (v: 'npc' | 'monster') => void;
  hp: string;
  onHpChange: (v: string) => void;
  ac: string;
  onAcChange: (v: string) => void;
  initMod: string;
  onInitModChange: (v: string) => void;
  hideName: boolean;
  onHideNameChange: (v: boolean) => void;
  playerAlias: string;
  onPlayerAliasChange: (v: string) => void;
  disposition: PlayerDisposition;
  onDispositionChange: (v: PlayerDisposition) => void;
  onEditStatBlock: () => void;
  hasStatBlockEdits: boolean;
}

export function CustomTab({
  customMonsters,
  onAddSavedMonster,
  name,
  onNameChange,
  type,
  onTypeChange,
  hp,
  onHpChange,
  ac,
  onAcChange,
  initMod,
  onInitModChange,
  hideName,
  onHideNameChange,
  playerAlias,
  onPlayerAliasChange,
  disposition,
  onDispositionChange,
  onEditStatBlock,
  hasStatBlockEdits,
}: CustomTabProps) {
  return (
    <div className="space-y-3 pb-4">
      <div className="space-y-2">
        <div>
          <h3 className="text-heading text-sm font-bold">
            Saved custom monsters
          </h3>
          <p className="text-muted text-xs">
            Select one to add its persistent stat block to this encounter.
          </p>
        </div>
        <SavedCreaturePicker
          creatures={customMonsters}
          emptyMessage="No custom monsters yet. Create them from the campaign page."
          onSelect={onAddSavedMonster}
        />
      </div>

      <div className="border-divider space-y-3 border-t pt-4">
        <h3 className="text-heading text-sm font-medium">One-off combatant</h3>
        <Input
          value={name}
          onChange={event => onNameChange(event.target.value)}
          placeholder="e.g. Cursed Statue"
          label="Name"
        />
        <div role="group" aria-label="Combatant type" className="space-y-2">
          <p className="text-body text-sm font-medium">Type</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              selected={type === 'npc'}
              onClick={() => onTypeChange('npc')}
            >
              NPC
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              selected={type === 'monster'}
              onClick={() => onTypeChange('monster')}
            >
              Monster
            </Button>
          </div>
        </div>
      </div>

      {/* HP / AC / Init Mod grid */}
      <div className="grid grid-cols-3 gap-3">
        <NumberInput
          value={hp === '' ? undefined : Number(hp)}
          onChange={v => onHpChange(v === undefined ? '' : String(v))}
          allowEmpty
          label="HP"
          min={0}
        />
        <NumberInput
          value={ac === '' ? undefined : Number(ac)}
          onChange={v => onAcChange(v === undefined ? '' : String(v))}
          allowEmpty
          label="AC"
          min={0}
        />
        <NumberInput
          value={initMod === '' ? undefined : Number(initMod)}
          onChange={v => onInitModChange(v === undefined ? '' : String(v))}
          allowEmpty
          label="Initiative modifier"
        />
      </div>

      <Button
        variant="outline"
        fullWidth
        onClick={onEditStatBlock}
        leftIcon={<FilePen size={14} />}
      >
        Edit stat block{hasStatBlockEdits ? ' (edited)' : ''}
      </Button>

      <SharedOptions
        hideName={hideName}
        onHideNameChange={onHideNameChange}
        playerAlias={playerAlias}
        onPlayerAliasChange={onPlayerAliasChange}
        disposition={disposition}
        onDispositionChange={onDispositionChange}
      />
    </div>
  );
}
