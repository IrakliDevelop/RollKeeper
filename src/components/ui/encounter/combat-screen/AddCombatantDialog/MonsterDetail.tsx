'use client';

import React from 'react';
import { ArrowLeft, Plus, Minus, FilePen } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import type { ProcessedMonster } from '@/types/bestiary';
import type { PlayerDisposition } from '@/types/encounter';
import { SharedOptions } from './SharedOptions';

interface MonsterDetailProps {
  selected: ProcessedMonster;
  hp: string;
  onHpChange: (v: string) => void;
  ac: string;
  onAcChange: (v: string) => void;
  count: number;
  onCountChange: (v: number) => void;
  hideName: boolean;
  onHideNameChange: (v: boolean) => void;
  playerAlias: string;
  onPlayerAliasChange: (v: string) => void;
  disposition: PlayerDisposition;
  onDispositionChange: (v: PlayerDisposition) => void;
  onBack: () => void;
  onEditStatBlock: () => void;
  hasEdits: boolean;
}

export function MonsterDetail({
  selected,
  hp,
  onHpChange,
  ac,
  onAcChange,
  count,
  onCountChange,
  hideName,
  onHideNameChange,
  playerAlias,
  onPlayerAliasChange,
  disposition,
  onDispositionChange,
  onBack,
  onEditStatBlock,
  hasEdits,
}: MonsterDetailProps) {
  const mType =
    typeof selected.type === 'string' ? selected.type : selected.type.type;

  return (
    <div className="space-y-3 pb-4">
      <button
        onClick={onBack}
        className="text-muted hover:text-heading flex items-center gap-1 text-[13.5px] font-bold transition-colors"
      >
        <ArrowLeft size={14} /> Back to search
      </button>

      {/* Stat card */}
      <div className="border-accent-purple-border bg-surface-raised rounded-[16px] border-[1.5px] p-[18px]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-display text-heading text-[21px] leading-tight font-extrabold">
              {selected.name}
            </h4>
            <p className="text-muted text-[12.5px]">
              {selected.size.join('/')} {mType}
              {selected.alignment ? `, ${selected.alignment}` : ''}
            </p>
          </div>
          <span className="bg-accent-purple-bg text-accent-purple-text shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold">
            CR {selected.cr}
          </span>
        </div>

        {/* HP / AC / Count */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div>
            <label className="text-muted mb-1 block text-[11px] font-extrabold tracking-wider uppercase">
              HP
            </label>
            <input
              type="number"
              value={hp}
              onChange={e => onHpChange(e.target.value)}
              className="border-divider bg-surface-secondary font-display w-full rounded-[10px] border-[1.5px] px-3 py-2.5 text-base font-bold focus:outline-none"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-[11px] font-extrabold tracking-wider uppercase">
              AC
            </label>
            <input
              type="number"
              value={ac}
              onChange={e => onAcChange(e.target.value)}
              className="border-divider bg-surface-secondary font-display w-full rounded-[10px] border-[1.5px] px-3 py-2.5 text-base font-bold focus:outline-none"
            />
          </div>
          <div>
            <label className="text-muted mb-1 block text-[11px] font-extrabold tracking-wider uppercase">
              Count
            </label>
            <div className="border-divider flex items-center overflow-hidden rounded-[10px] border-[1.5px]">
              <button
                aria-label="Decrease count"
                onClick={() => onCountChange(Math.max(1, count - 1))}
                className="bg-surface-secondary flex h-[42px] w-9 items-center justify-center"
              >
                <Minus size={16} />
              </button>
              <span className="font-display flex-1 text-center text-base font-bold tabular-nums">
                {count}
              </span>
              <button
                aria-label="Increase count"
                onClick={() => onCountChange(Math.min(20, count + 1))}
                className="bg-surface-secondary flex h-[42px] w-9 items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Ability scores */}
        <div className="mt-4 grid grid-cols-6 gap-1.5">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => (
            <div
              key={ab}
              className="bg-surface-secondary rounded-[9px] py-[7px] text-center"
            >
              <div className="text-muted block text-[9.5px] font-extrabold uppercase">
                {ab}
              </div>
              <div className="font-display text-heading text-[15px] font-bold">
                {selected[ab]}
              </div>
            </div>
          ))}
        </div>

        <p className="text-faint mt-3 text-[11.5px] font-semibold">
          HP formula {selected.hpFormula}
          {selected.actions && selected.actions.length > 0
            ? ` · ${selected.actions.length} action(s)`
            : ''}
          {selected.legendaryActions && selected.legendaryActions.length > 0
            ? ' · Legendary'
            : ''}
        </p>
      </div>

      <Button
        variant="outline"
        fullWidth
        onClick={onEditStatBlock}
        leftIcon={<FilePen size={14} />}
      >
        Edit stat block{hasEdits ? ' (edited)' : ''}
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
