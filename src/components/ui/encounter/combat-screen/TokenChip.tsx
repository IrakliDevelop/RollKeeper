'use client';

import React, { useState } from 'react';
import {
  ChessBishop,
  ChessKing,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Milk,
} from 'lucide-react';
import type { ChessPiece, EncounterEntity } from '@/types/encounter';
import type { EntityActions } from './types';

export interface TokenChipProps {
  entity: EncounterEntity;
  size: 'sm' | 'md';
  actions: Pick<EntityActions, 'onUpdate' | 'onChangePlayerColor'>;
}

export const CHESS_PIECES: {
  piece: ChessPiece;
  Icon: React.ComponentType<{
    size?: number;
    className?: string;
    style?: React.CSSProperties;
  }>;
}[] = [
  { piece: 'king', Icon: ChessKing },
  { piece: 'queen', Icon: ChessQueen },
  { piece: 'rook', Icon: ChessRook },
  { piece: 'bishop', Icon: ChessBishop },
  { piece: 'knight', Icon: ChessKnight },
  { piece: 'pawn', Icon: ChessPawn },
];

export const PIECE_COLORS = [
  { name: 'White', value: '#e2e8f0' },
  { name: 'Black', value: '#1e293b' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Brown', value: '#92400e' },
];

function getChessPieceIcon(piece: ChessPiece) {
  return CHESS_PIECES.find(p => p.piece === piece)?.Icon;
}

export function TokenChip({ entity, size, actions }: TokenChipProps) {
  const [open, setOpen] = useState(false);
  const isPlayer = entity.type === 'player';
  const dimClass = size === 'sm' ? 'h-8 w-8' : 'h-[34px] w-[34px]';
  const Icon = entity.chessPiece ? getChessPieceIcon(entity.chessPiece) : null;
  const color = entity.color;

  function handlePieceChange(piece: ChessPiece | undefined) {
    actions.onUpdate(entity.id, { chessPiece: piece });
  }

  function handleColorChange(c: string | undefined) {
    actions.onUpdate(entity.id, { color: c });
    if (isPlayer) {
      actions.onChangePlayerColor?.(entity.playerCharacterId ?? entity.id, c);
    }
  }

  if (!open) {
    const closedTitle = isPlayer
      ? color
        ? 'Figurine color — click to change'
        : 'Assign figurine color'
      : entity.chessPiece
        ? `${entity.chessPiece} — click to change`
        : 'Assign chess piece';
    return (
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`${dimClass} border-divider bg-surface-raised hover:border-divider-strong flex shrink-0 items-center justify-center rounded-md border shadow-sm transition-colors`}
        title={closedTitle}
      >
        {isPlayer ? (
          <Milk
            size={18}
            style={color ? { color } : undefined}
            className={color ? '' : 'opacity-40'}
          />
        ) : Icon ? (
          <Icon
            size={18}
            style={color ? { color } : undefined}
            className={color ? '' : 'text-heading'}
          />
        ) : (
          <ChessPawn size={14} className="opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      className="border-divider bg-surface-raised z-10 flex flex-col gap-1.5 rounded-lg border p-1.5 shadow-lg"
    >
      {!isPlayer && (
        <div className="flex items-center gap-0.5">
          {CHESS_PIECES.map(({ piece: p, Icon: I }) => (
            <button
              key={p}
              onClick={() =>
                handlePieceChange(p === entity.chessPiece ? undefined : p)
              }
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                p === entity.chessPiece
                  ? 'bg-accent-amber-bg-strong text-heading'
                  : 'text-muted hover:bg-surface-secondary hover:text-heading'
              }`}
              title={p.charAt(0).toUpperCase() + p.slice(1)}
            >
              <I
                size={16}
                style={color && p === entity.chessPiece ? { color } : undefined}
              />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-0.5">
        {PIECE_COLORS.map(c => (
          <button
            key={c.value}
            onClick={() =>
              handleColorChange(c.value === color ? undefined : c.value)
            }
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              c.value === color
                ? 'ring-heading ring-2'
                : 'hover:bg-surface-secondary'
            }`}
            title={c.name}
          >
            <span
              className="border-divider h-4 w-4 rounded-full border"
              style={{ backgroundColor: c.value }}
            />
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between">
        {(entity.chessPiece ?? color) && (
          <button
            onClick={() => {
              handlePieceChange(undefined);
              handleColorChange(undefined);
              setOpen(false);
            }}
            className="text-faint hover:text-accent-red-text px-1 text-[10px] font-medium transition-colors"
          >
            Clear
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className="text-faint hover:text-heading ml-auto px-1 text-[10px] font-medium transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
