'use client';

import { SwatchButton } from '@/components/ui/campaign/location-map/ToolOptionControls';
import {
  CHESS_PIECES,
  PIECE_COLORS,
} from '@/components/ui/encounter/combat-screen/TokenChip';
import { Button } from '@/components/ui/forms/button';
import { Tooltip } from '@/components/ui/primitives/Tooltip';

import type { EncounterEntity } from '@/types/encounter';

export interface TokenAppearanceRowProps {
  entity: EncounterEntity;
  onChange: (updates: Pick<EncounterEntity, 'chessPiece' | 'color'>) => void;
}

/**
 * Studio-panel controls: chess piece + color swatches for map-correlation
 * identity (mirrors the encounter page's `TokenChip` picker). Both rows are
 * radiogroups with a "none"/"clear" option to unset. Tooltips need a
 * `TooltipProvider` above (`TokenSettings` supplies it).
 */
export function TokenAppearanceRow({
  entity,
  onChange,
}: TokenAppearanceRowProps) {
  const piece = entity.chessPiece;
  const color = entity.color;

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <div
        className="flex flex-wrap items-center gap-1"
        role="radiogroup"
        aria-label="Chess piece"
      >
        {CHESS_PIECES.map(({ piece: p, Icon }) => {
          const name = p.charAt(0).toUpperCase() + p.slice(1);
          return (
            <Tooltip key={p} content={name}>
              <Button
                variant="ghost"
                size="sm"
                className="w-9 shrink-0 px-0"
                selected={p === piece}
                role="radio"
                aria-checked={p === piece}
                aria-label={name}
                onClick={() =>
                  onChange({ chessPiece: p === piece ? undefined : p })
                }
              >
                <Icon size={18} aria-hidden="true" />
              </Button>
            </Tooltip>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          selected={piece === undefined}
          role="radio"
          aria-checked={piece === undefined}
          onClick={() => onChange({ chessPiece: undefined })}
        >
          None
        </Button>
      </div>
      <div
        className="flex flex-wrap items-center gap-1"
        role="radiogroup"
        aria-label="Token color"
      >
        {PIECE_COLORS.map(c => (
          <SwatchButton
            key={c.value}
            semantics="radio"
            name={c.name}
            color={c.value}
            selected={c.value === color}
            onSelect={() =>
              onChange({ color: c.value === color ? undefined : c.value })
            }
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          selected={color === undefined}
          role="radio"
          aria-checked={color === undefined}
          onClick={() => onChange({ color: undefined })}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}
