'use client';

import {
  CHESS_PIECES,
  PIECE_COLORS,
} from '@/components/ui/encounter/combat-screen/TokenChip';

import type { EncounterEntity } from '@/types/encounter';

export interface TokenAppearanceRowProps {
  entity: EncounterEntity;
  onChange: (updates: Pick<EncounterEntity, 'chessPiece' | 'color'>) => void;
}

/**
 * Studio-panel controls: chess piece + color swatches for map-correlation
 * identity (mirrors the encounter page's `TokenChip` picker). Both rows are
 * radiogroups with a "none"/"clear" option to unset.
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
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Chess piece"
      >
        {CHESS_PIECES.map(({ piece: p, Icon }) => (
          <button
            key={p}
            type="button"
            onClick={() =>
              onChange({ chessPiece: p === piece ? undefined : p })
            }
            className={`flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded transition-colors ${
              p === piece
                ? 'bg-accent-amber-bg-strong text-heading'
                : 'text-muted hover:bg-surface-secondary hover:text-heading'
            }`}
            role="radio"
            aria-checked={p === piece}
            title={p.charAt(0).toUpperCase() + p.slice(1)}
          >
            <Icon size={18} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange({ chessPiece: undefined })}
          className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[10px] font-semibold transition-colors ${
            piece === undefined
              ? 'bg-accent-amber-bg-strong text-heading'
              : 'text-muted hover:bg-surface-secondary hover:text-heading'
          }`}
          role="radio"
          aria-checked={piece === undefined}
          title="No piece"
        >
          None
        </button>
      </div>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label="Token color"
      >
        {PIECE_COLORS.map(c => (
          <button
            key={c.value}
            type="button"
            onClick={() =>
              onChange({ color: c.value === color ? undefined : c.value })
            }
            className={`flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center rounded transition-colors ${
              c.value === color
                ? 'ring-heading ring-2'
                : 'hover:bg-surface-secondary'
            }`}
            role="radio"
            aria-checked={c.value === color}
            title={c.name}
          >
            <span
              className="border-divider h-4 w-4 rounded-full border"
              style={{ backgroundColor: c.value }}
            />
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange({ color: undefined })}
          className="text-faint hover:text-accent-red-text flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-[10px] font-semibold transition-colors"
          role="radio"
          aria-checked={color === undefined}
          title="Clear color"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
