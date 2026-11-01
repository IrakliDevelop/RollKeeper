'use client';

import { useId } from 'react';

import { Checkbox } from '@/components/ui/forms/checkbox';
import { Button } from '@/components/ui/forms/button';
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

const DISPOSITIONS: PlayerDisposition[] = ['ally', 'neutral', 'enemy'];

export function SharedOptions({
  hideName,
  onHideNameChange,
  playerAlias,
  onPlayerAliasChange,
  disposition,
  onDispositionChange,
}: SharedOptionsProps) {
  const dispositionLabelId = useId();
  return (
    <div className="border-divider space-y-4 border-t pt-4">
      <Checkbox
        size="sm"
        label="Hide name from players"
        checked={hideName}
        onCheckedChange={onHideNameChange}
      />
      {hideName && (
        <Input
          value={playerAlias}
          onChange={event => onPlayerAliasChange(event.target.value)}
          placeholder="Name players see (optional)"
          label="Player alias"
        />
      )}
      <div
        role="group"
        aria-labelledby={dispositionLabelId}
        className="space-y-2"
      >
        <p id={dispositionLabelId} className="text-body text-sm font-medium">
          Player sees as
        </p>
        <div className="flex flex-wrap gap-2">
          {DISPOSITIONS.map(value => (
            <Button
              key={value}
              type="button"
              variant="outline"
              size="sm"
              selected={disposition === value}
              aria-pressed={disposition === value}
              onClick={() => onDispositionChange(value)}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
