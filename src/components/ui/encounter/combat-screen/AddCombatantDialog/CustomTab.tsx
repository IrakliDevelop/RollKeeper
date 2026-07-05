'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import type { EncounterEntity, PlayerDisposition } from '@/types/encounter';
import { buildCustomEntity } from './buildEntity';
import { SharedOptions } from './SharedOptions';

interface CustomTabProps {
  onAdd: (entity: Omit<EncounterEntity, 'id'>) => void;
}

export function CustomTab({ onAdd }: CustomTabProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'npc' | 'monster'>('npc');
  const [hp, setHp] = useState('10');
  const [ac, setAc] = useState('10');
  const [initMod, setInitMod] = useState('0');
  const [hideName, setHideName] = useState(false);
  const [playerAlias, setPlayerAlias] = useState('');
  const [disposition, setDisposition] = useState<PlayerDisposition>('enemy');

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(
      buildCustomEntity({
        name,
        type,
        hp: parseInt(hp) || 10,
        ac: parseInt(ac) || 10,
        initMod: parseInt(initMod) || 0,
        isHidden: hideName,
        playerAlias: playerAlias || undefined,
        playerDisposition: disposition,
      })
    );
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Name */}
      <div>
        <label className="text-body mb-1.5 block text-[11px] font-extrabold tracking-[0.06em] uppercase">
          Name
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
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
            onClick={() => setType('npc')}
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
            onClick={() => setType('monster')}
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
        <Input
          value={hp}
          onChange={e => setHp(e.target.value)}
          label="HP"
          type="number"
        />
        <Input
          value={ac}
          onChange={e => setAc(e.target.value)}
          label="AC"
          type="number"
        />
        <Input
          value={initMod}
          onChange={e => setInitMod(e.target.value)}
          label="Init Mod"
          type="number"
        />
      </div>

      <SharedOptions
        hideName={hideName}
        onHideNameChange={setHideName}
        playerAlias={playerAlias}
        onPlayerAliasChange={setPlayerAlias}
        disposition={disposition}
        onDispositionChange={setDisposition}
      />

      {/* Footer add button */}
      <div className="border-divider border-t pt-3.5 pb-4">
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="bg-accent-emerald-text-muted flex w-full items-center justify-center gap-1.5 rounded-[13px] py-[15px] text-[15px] font-extrabold text-white shadow-[0_5px_16px_-5px_rgba(18,133,92,0.6)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} />
          Add {type === 'npc' ? 'NPC' : 'Monster'}
        </button>
      </div>
    </div>
  );
}
