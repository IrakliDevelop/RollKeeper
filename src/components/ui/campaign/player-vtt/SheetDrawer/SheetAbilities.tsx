'use client';

import { useMemo, type ReactNode } from 'react';

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

function MaybeRollElement({
  onRoll,
  ariaLabel,
  className,
  children,
}: {
  onRoll?: () => void;
  ariaLabel: string;
  className: string;
  children: ReactNode;
}) {
  if (onRoll) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onRoll}
        className={className}
      >
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
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
      <MaybeRollElement
        ariaLabel={`Roll ${cell.name} check`}
        className="w-full"
        onRoll={
          roll ? () => roll(`${cell.name} Check`, cell.modifier) : undefined
        }
      >
        <div className="text-faint text-xs uppercase">{cell.abbr}</div>
        <div className="text-heading text-lg font-bold">
          {formatModifier(cell.modifier)}
        </div>
      </MaybeRollElement>

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

      <MaybeRollElement
        ariaLabel={`Roll ${cell.name} save`}
        className="text-faint flex w-full items-center justify-center gap-1 text-[10px] uppercase"
        onRoll={roll ? () => roll(`${cell.name} Save`, cell.save) : undefined}
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
      </MaybeRollElement>
    </div>
  );
}
