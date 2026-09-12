'use client';

import React from 'react';
import { FilePen } from 'lucide-react';
import { NumberInput } from '@/components/ui/forms/NumberInput';
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

      <div className="flex items-center gap-3 py-1" aria-hidden="true">
        <div className="bg-divider h-px flex-1" />
        <span className="text-faint text-[10px] font-bold tracking-wide uppercase">
          One-off combatant
        </span>
        <div className="bg-divider h-px flex-1" />
      </div>

      {/* Name */}
      <div>
        <label className="text-body mb-1.5 block text-[11px] font-extrabold tracking-[0.06em] uppercase">
          Name
        </label>
        <input
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="e.g. Cursed Statue"
          className="border-divider bg-surface-raised focus:border-accent-amber-border w-full rounded-[11px] border-[1.5px] px-[14px] py-3 text-sm focus:outline-none"
        />
      </div>

      {/* Type segment */}
      <div>
        <label className="text-body mb-1.5 block text-[11px] font-extrabold tracking-[0.06em] uppercase">
          Type
        </label>
        <div className="bg-surface-secondary inline-flex rounded-[10px] p-[3px]">
          <button
            type="button"
            onClick={() => onTypeChange('npc')}
            className={`rounded-lg px-4 py-1.5 text-[12.5px] font-bold transition-colors ${
              type === 'npc'
                ? 'bg-surface-raised text-accent-amber-text shadow-sm'
                : 'text-muted'
            }`}
          >
            NPC
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('monster')}
            className={`rounded-lg px-4 py-1.5 text-[12.5px] font-bold transition-colors ${
              type === 'monster'
                ? 'bg-surface-raised text-accent-purple-text shadow-sm'
                : 'text-muted'
            }`}
          >
            Monster
          </button>
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
          label="Init Mod"
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
