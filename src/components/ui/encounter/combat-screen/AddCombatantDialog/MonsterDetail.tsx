'use client';

import React from 'react';
import { ArrowLeft, FilePen } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { NumberInput } from '@/components/ui/forms/NumberInput';
import { Badge } from '@/components/ui/layout/badge';
import type { ProcessedMonster } from '@/types/bestiary';
import type { PlayerDisposition } from '@/types/encounter';
import { bestiaryTokenUrl } from '@/utils/bestiaryTokenUrl';
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
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        leftIcon={<ArrowLeft size={16} />}
      >
        Back to search
      </Button>

      {/* Stat card */}
      <div className="border-divider space-y-4 border-b pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            {selected.hasToken && selected.tokenSource && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bestiaryTokenUrl(selected.tokenSource, selected.name)}
                alt=""
                className="border-divider h-12 w-12 shrink-0 rounded-full border object-cover"
                onError={e => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
            <div className="min-w-0">
              <h4 className="text-heading text-lg font-semibold">
                {selected.name}
              </h4>
              <p className="text-muted text-[12.5px]">
                {selected.size.join('/')} {mType}
                {selected.alignment ? `, ${selected.alignment}` : ''}
              </p>
            </div>
          </div>
          <Badge variant="neutral" size="sm">
            CR {selected.cr}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <NumberInput
            value={hp === '' ? undefined : Number(hp)}
            onChange={value =>
              onHpChange(value === undefined ? '' : String(value))
            }
            label="HP"
            allowEmpty
            min={0}
          />
          <NumberInput
            value={ac === '' ? undefined : Number(ac)}
            onChange={value =>
              onAcChange(value === undefined ? '' : String(value))
            }
            label="AC"
            allowEmpty
            min={0}
          />
          <NumberInput
            value={count}
            onChange={value => onCountChange(value ?? 1)}
            label="Count"
            min={1}
            max={20}
          />
        </div>

        {/* Ability scores */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(ab => (
            <div key={ab} className="border-divider border-l pl-2">
              <div className="text-muted block text-xs uppercase">{ab}</div>
              <div className="text-heading text-sm font-medium tabular-nums">
                {selected[ab]}
              </div>
            </div>
          ))}
        </div>

        <p className="text-muted text-xs">
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
