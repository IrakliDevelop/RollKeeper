'use client';

import { useMemo } from 'react';

import { NumberInput } from '@/components/ui/forms/NumberInput';
import { useCharacterStore } from '@/store/characterStore';
import { formatModifier } from '@/utils/calculations';
import { cn } from '@/utils/cn';

import { buildAbilityCells } from './SheetDrawer.utils';
import type { AbilityCellView } from './SheetDrawer.types';

export interface SheetAbilitiesProps {
  locked: boolean;
  roll?: (label: string, modifier: number) => Promise<void>;
}

export function SheetAbilities({ locked, roll }: SheetAbilitiesProps) {
  const character = useCharacterStore(s => s.character);
  const updateAbilityScore = useCharacterStore(s => s.updateAbilityScore);
  const cells = useMemo(() => buildAbilityCells(character), [character]);

  return (
    <div className="grid grid-cols-6 gap-2">
      {cells.map(cell => (
        <AbilityCell
          key={cell.ability}
          cell={cell}
          locked={locked}
          roll={roll}
          onScoreChange={value => updateAbilityScore(cell.ability, value)}
        />
      ))}
    </div>
  );
}

function AbilityCell({
  cell,
  locked,
  roll,
  onScoreChange,
}: {
  cell: AbilityCellView;
  locked: boolean;
  roll?: (label: string, modifier: number) => Promise<void>;
  onScoreChange: (value: number) => void;
}) {
  return (
    <div className="border-divider bg-surface flex flex-col items-center gap-1 rounded-lg border p-2 text-center">
      {roll ? (
        <button
          type="button"
          aria-label={`Roll ${cell.name} check`}
          onClick={() => roll(`${cell.name} Check`, cell.modifier)}
          className="w-full"
        >
          <div className="text-faint text-xs uppercase">{cell.abbr}</div>
          <div className="text-heading text-lg font-bold">
            {formatModifier(cell.modifier)}
          </div>
        </button>
      ) : (
        <div className="w-full">
          <div className="text-faint text-xs uppercase">{cell.abbr}</div>
          <div className="text-heading text-lg font-bold">
            {formatModifier(cell.modifier)}
          </div>
        </div>
      )}

      {locked ? (
        <span className="text-muted text-xs">{cell.score}</span>
      ) : (
        <NumberInput
          aria-label={`${cell.name} score`}
          value={cell.score}
          onChange={value => value !== undefined && onScoreChange(value)}
          min={1}
          max={30}
          className="h-7 w-full px-1 text-center text-xs"
        />
      )}

      {roll ? (
        <button
          type="button"
          aria-label={`Roll ${cell.name} save`}
          onClick={() => roll(`${cell.name} Save`, cell.save)}
          className="text-faint flex w-full items-center justify-center gap-1 text-[10px] uppercase"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              cell.saveProficient
                ? 'bg-accent-emerald-text-muted'
                : 'border-divider border'
            )}
          />
          SAVE {formatModifier(cell.save)}
        </button>
      ) : (
        <div className="text-faint flex w-full items-center justify-center gap-1 text-[10px] uppercase">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              cell.saveProficient
                ? 'bg-accent-emerald-text-muted'
                : 'border-divider border'
            )}
          />
          SAVE {formatModifier(cell.save)}
        </div>
      )}
    </div>
  );
}
