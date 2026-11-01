'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ChessBishop,
  ChessKing,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Milk,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
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

// Persisted token colour data, not the interface palette.
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

export function TokenChip({ entity, size, actions }: TokenChipProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const isPlayer = entity.type === 'player';
  const Icon = CHESS_PIECES.find(p => p.piece === entity.chessPiece)?.Icon;
  const color = entity.color;

  useEffect(() => {
    if (open) firstOptionRef.current?.focus();
    else if (returnFocus.current) {
      const timer = setTimeout(() => triggerRef.current?.focus(), 0);
      returnFocus.current = false;
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !panelRef.current?.contains(event.target)
      ) {
        returnFocus.current = true;
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        returnFocus.current = true;
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleClose = () => {
    returnFocus.current = true;
    setOpen(false);
  };

  const handlePieceChange = (piece: ChessPiece | undefined) => {
    actions.onUpdate(entity.id, { chessPiece: piece });
  };

  const handleColorChange = (nextColor: string | undefined) => {
    actions.onUpdate(entity.id, { color: nextColor });
    const pcId = entity.playerCharacterId;
    if (pcId !== undefined) actions.onChangePlayerColor?.(pcId, nextColor);
  };

  if (!open) {
    return (
      <Button
        ref={triggerRef}
        variant="ghost"
        size="xs"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${entity.name} token`}
        className={size === 'sm' ? 'shrink-0 px-1' : 'shrink-0 px-2'}
      >
        {isPlayer ? (
          <Milk
            size={18}
            style={color ? { color } : undefined}
            className={color ? '' : 'text-muted'}
            aria-hidden="true"
          />
        ) : Icon ? (
          <Icon
            size={18}
            style={color ? { color } : undefined}
            className={color ? '' : 'text-heading'}
            aria-hidden="true"
          />
        ) : (
          <ChessPawn size={18} className="text-muted" aria-hidden="true" />
        )}
      </Button>
    );
  }

  return (
    <div
      ref={panelRef}
      className="border-divider bg-surface-elevated z-10 flex max-w-full flex-col gap-2 rounded-md border p-2"
      role="group"
      aria-label={`${entity.name} token appearance`}
    >
      {!isPlayer && (
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Chess piece"
        >
          {CHESS_PIECES.map(({ piece, Icon: PieceIcon }, index) => (
            <Button
              key={piece}
              ref={index === 0 ? firstOptionRef : undefined}
              variant="ghost"
              selected={piece === entity.chessPiece}
              aria-pressed={piece === entity.chessPiece}
              size="xs"
              onClick={() =>
                handlePieceChange(
                  piece === entity.chessPiece ? undefined : piece
                )
              }
              aria-label={`${piece.charAt(0).toUpperCase()}${piece.slice(1)} for ${entity.name}`}
              className="px-2"
            >
              <PieceIcon
                size={16}
                style={
                  color && piece === entity.chessPiece ? { color } : undefined
                }
                aria-hidden="true"
              />
            </Button>
          ))}
        </div>
      )}
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label="Token color"
      >
        {PIECE_COLORS.map((choice, index) => (
          <Button
            key={choice.value}
            ref={isPlayer && index === 0 ? firstOptionRef : undefined}
            variant="ghost"
            selected={choice.value === color}
            aria-pressed={choice.value === color}
            size="xs"
            onClick={() =>
              handleColorChange(
                choice.value === color ? undefined : choice.value
              )
            }
            aria-label={`${choice.name} for ${entity.name}`}
            className="px-2"
          >
            <span
              className="border-divider size-4 rounded-full border"
              style={{ backgroundColor: choice.value }}
              aria-hidden="true"
            />
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {(entity.chessPiece ?? color) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              handlePieceChange(undefined);
              handleColorChange(undefined);
              handleClose();
            }}
          >
            Clear token
          </Button>
        )}
        <Button size="sm" onClick={handleClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
