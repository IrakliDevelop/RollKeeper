'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Input } from '@/components/ui/forms/input';
import type { PlayerDisposition } from '@/types/encounter';

interface SharedOptionsProps {
  hideName: boolean;
  onHideNameChange: (v: boolean) => void;
  playerAlias: string;
  onPlayerAliasChange: (v: string) => void;
  disposition: PlayerDisposition;
  onDispositionChange: (v: PlayerDisposition) => void;
}

interface DispositionOption {
  value: PlayerDisposition;
  label: string;
  activeClass: string;
}

const DISPOSITION_OPTIONS: DispositionOption[] = [
  {
    value: 'ally',
    label: 'Ally',
    activeClass: 'bg-surface-raised text-accent-emerald-text shadow-sm',
  },
  {
    value: 'enemy',
    label: 'Enemy',
    activeClass: 'bg-surface-raised text-accent-red-text shadow-sm',
  },
  {
    value: 'neutral',
    label: 'Neutral',
    activeClass: 'bg-surface-raised text-muted shadow-sm',
  },
];

export function SharedOptions({
  hideName,
  onHideNameChange,
  playerAlias,
  onPlayerAliasChange,
  disposition,
  onDispositionChange,
}: SharedOptionsProps) {
  return (
    <div className="border-divider mt-4 space-y-3 border-t pt-4">
      {/* Hide name checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={hideName}
        onClick={() => onHideNameChange(!hideName)}
        className="flex items-center gap-2"
      >
        <span
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border-[1.5px] transition-colors ${
            hideName
              ? 'bg-accent-amber-text border-accent-amber-text'
              : 'bg-surface-raised border-divider-strong'
          }`}
        >
          {hideName && <Check size={12} className="text-white" />}
        </span>
        <span className="text-body text-[13.5px] font-semibold">
          Hide name from players
        </span>
      </button>

      {/* Alias input — only when hidden */}
      {hideName && (
        <Input
          value={playerAlias}
          onChange={e => onPlayerAliasChange(e.target.value)}
          placeholder="Name players see (optional)"
          label="Player alias"
        />
      )}

      {/* Faction segment */}
      <div>
        <label className="text-muted mb-1.5 block text-[11px] font-extrabold tracking-wider uppercase">
          Player sees as
        </label>
        <div className="bg-surface-secondary inline-flex rounded-[10px] p-[3px]">
          {DISPOSITION_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onDispositionChange(opt.value)}
              className={`rounded-lg px-[15px] py-[7px] text-[12.5px] font-bold transition-colors ${
                disposition === opt.value ? opt.activeClass : 'text-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
