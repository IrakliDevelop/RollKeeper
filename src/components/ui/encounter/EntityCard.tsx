'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Shield,
  Eye,
  Sparkles,
  Angry,
  Minus,
  Plus,
  ChessBishop,
  ChessKing,
  ChessKnight,
  ChessPawn,
  ChessQueen,
  ChessRook,
  Milk,
  Skull,
  X,
  Brain,
  ClockAlert,
} from 'lucide-react';
import { EncounterEntity, ChessPiece } from '@/types/encounter';
import { HPBar } from '@/components/shared/combat/HPBar';
import { ConditionBadge } from '@/components/shared/combat/ConditionBadge';
import { EntityCardExpanded } from './EntityCardExpanded';

interface EntityCardProps {
  entity: EncounterEntity;
  isCurrentTurn: boolean;
  hidePlayerHp?: boolean;
  lastSynced?: string; // ISO timestamp for player sync freshness
  customCounterLabel?: string; // DM-named counter label
  onUpdate: (updates: Partial<EncounterEntity>) => void;
  onRemove: () => void;
  onDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onAddCondition: (condition: { name: string; description?: string }) => void;
  onRemoveCondition: (conditionId: string) => void;
  onUseAbility: (abilityId: string) => void;
  onRestoreAbility: (abilityId: string) => void;
  onUseLegendaryAction: (actionId: string) => void;
  onResetLegendaryActions: () => void;
  onSetConcentration: (spellName: string | null) => void;
  onUseLairAction?: (actionId: string) => void;
  onSetInitiative: (value: number) => void;
  counterValue?: number;
  onAdjustCounter?: (delta: number) => void;
  onViewPlayer?: () => void;
  onViewNPC?: () => void;
  onChangePlayerColor?: (color: string | undefined) => void;
  onLongRest?: () => void;
}

const TYPE_STYLES: Record<
  string,
  { border: string; badge: string; badgeBg: string; cardBg: string }
> = {
  player: {
    border: 'border-accent-blue-border',
    badge: 'text-accent-blue-text',
    badgeBg: 'bg-accent-blue-bg-strong',
    cardBg: 'bg-accent-blue-bg',
  },
  npc: {
    border: 'border-accent-amber-border',
    badge: 'text-accent-amber-text',
    badgeBg: 'bg-accent-amber-bg-strong',
    cardBg: 'bg-accent-amber-bg',
  },
  monster: {
    border: 'border-accent-purple-border',
    badge: 'text-accent-purple-text',
    badgeBg: 'bg-accent-purple-bg-strong',
    cardBg: 'bg-accent-purple-bg',
  },
  lair: {
    border: 'border-accent-emerald-border',
    badge: 'text-accent-emerald-text',
    badgeBg: 'bg-accent-emerald-bg-strong',
    cardBg: 'bg-accent-emerald-bg',
  },
};

const CHESS_PIECES: {
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

const PIECE_COLORS = [
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

function ChessPiecePicker({
  piece,
  color,
  onChangePiece,
  onChangeColor,
}: {
  piece?: ChessPiece;
  color?: string;
  onChangePiece: (piece: ChessPiece | undefined) => void;
  onChangeColor: (color: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    const Icon = piece ? getChessPieceIcon(piece) : null;
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
          Icon || color
            ? 'bg-surface-raised shadow-sm'
            : 'text-faint hover:text-muted hover:bg-surface-raised'
        }`}
        title={
          piece
            ? `${piece}${color ? ` (${PIECE_COLORS.find(c => c.value === color)?.name ?? color})` : ''} — click to change`
            : 'Assign chess piece'
        }
      >
        {Icon ? (
          <Icon
            size={18}
            style={color ? { color } : undefined}
            className={color ? '' : 'text-heading'}
          />
        ) : color ? (
          <span
            className="border-divider h-4 w-4 rounded-full border"
            style={{ backgroundColor: color }}
          />
        ) : (
          <ChessPawn size={14} className="opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="bg-surface-raised z-10 flex flex-col gap-1.5 rounded-lg p-1.5 shadow-lg">
      {/* Piece row */}
      <div className="flex items-center gap-0.5">
        {CHESS_PIECES.map(({ piece: p, Icon }) => (
          <button
            key={p}
            onClick={() => onChangePiece(p === piece ? undefined : p)}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              p === piece
                ? 'bg-accent-amber-bg-strong text-heading'
                : 'text-muted hover:text-heading hover:bg-surface-secondary'
            }`}
            title={p.charAt(0).toUpperCase() + p.slice(1)}
          >
            <Icon
              size={16}
              style={color && p === piece ? { color } : undefined}
            />
          </button>
        ))}
      </div>
      {/* Color row */}
      <div className="flex items-center gap-0.5">
        {PIECE_COLORS.map(c => (
          <button
            key={c.value}
            onClick={() =>
              onChangeColor(c.value === color ? undefined : c.value)
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
      {/* Actions */}
      <div className="flex items-center justify-between">
        {(piece || color) && (
          <button
            onClick={() => {
              onChangePiece(undefined);
              onChangeColor(undefined);
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

function PlayerColorPicker({
  color,
  onChange,
}: {
  color?: string;
  onChange: (color: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
          color
            ? 'bg-surface-raised shadow-sm'
            : 'text-faint hover:text-muted hover:bg-surface-raised'
        }`}
        title={
          color
            ? `Figurine color: ${PIECE_COLORS.find(c => c.value === color)?.name ?? color} — click to change`
            : 'Assign figurine color'
        }
      >
        <Milk
          size={18}
          style={color ? { color } : undefined}
          className={color ? '' : 'opacity-40'}
        />
      </button>
    );
  }

  return (
    <div className="bg-surface-raised z-10 flex flex-col gap-1.5 rounded-lg p-1.5 shadow-lg">
      <div className="flex items-center gap-0.5">
        {PIECE_COLORS.map(c => (
          <button
            key={c.value}
            onClick={() => {
              onChange(c.value === color ? undefined : c.value);
              setOpen(false);
            }}
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
        {color && (
          <button
            onClick={() => {
              onChange(undefined);
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

function DmCounterControl({
  label,
  value,
  onAdjust,
}: {
  label: string;
  value: number;
  onAdjust: (delta: number) => void;
}) {
  return (
    <div
      className="bg-accent-purple-bg flex items-center gap-1 rounded-full px-1.5 py-0.5"
      title={label}
    >
      <Angry size={10} className="text-accent-purple-text" />
      <button
        onClick={e => {
          e.stopPropagation();
          onAdjust(-1);
        }}
        className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
        disabled={value <= 0}
      >
        <Minus size={10} />
      </button>
      <span className="text-accent-purple-text min-w-[1rem] text-center text-[11px] font-bold tabular-nums">
        {value}
      </span>
      <button
        onClick={e => {
          e.stopPropagation();
          onAdjust(1);
        }}
        className="text-accent-purple-text hover:bg-surface-secondary rounded p-0.5 transition-colors"
      >
        <Plus size={10} />
      </button>
    </div>
  );
}

function SyncIndicator({ lastSynced }: { lastSynced?: string }) {
  if (!lastSynced) return null;
  const ago = Date.now() - new Date(lastSynced).getTime();
  const color =
    ago < 30000
      ? 'bg-green-500'
      : ago < 120000
        ? 'bg-yellow-500'
        : 'bg-red-500';
  const label =
    ago < 30000
      ? 'Synced recently'
      : ago < 120000
        ? 'Synced >30s ago'
        : 'Sync stale';
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`}
      title={label}
    />
  );
}

export function EntityCard({
  entity,
  isCurrentTurn,
  hidePlayerHp,
  lastSynced,
  customCounterLabel,
  onUpdate,
  onRemove,
  onDamage,
  onHeal,
  onAddCondition,
  onRemoveCondition,
  onUseAbility,
  onRestoreAbility,
  onUseLegendaryAction,
  onResetLegendaryActions,
  onSetConcentration,
  onUseLairAction,
  onSetInitiative,
  counterValue = 0,
  onAdjustCounter,
  onViewPlayer,
  onViewNPC,
  onChangePlayerColor,
  onLongRest,
}: EntityCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingInit, setEditingInit] = useState(false);
  const [initInput, setInitInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const style = entity.summonOwnerId
    ? TYPE_STYLES.player
    : (TYPE_STYLES[entity.type] ?? TYPE_STYLES.monster);
  const isDown = entity.currentHp <= 0 && entity.type !== 'lair';
  const hasDeathSaves = entity.type === 'player' || entity.type === 'npc';
  const isDeathSaveDead = hasDeathSaves && entity.deathSaves?.failures === 3;
  const isDead = hasDeathSaves ? isDeathSaveDead : isDown;

  return (
    <div
      className={`relative rounded-lg transition-all ${style.cardBg} ${style.border} border-2 ${
        isCurrentTurn
          ? 'shadow-accent-amber-bg-strong ring-accent-amber-border scale-[1.01] shadow-lg ring-2'
          : 'shadow-sm'
      } ${isDead ? 'opacity-60' : ''} ${entity.isHidden ? 'border-dashed' : ''}`}
    >
      {/* Active turn — pulsing left strip */}
      {isCurrentTurn && (
        <div className="bg-accent-amber-text animate-turn-pulse absolute inset-y-0 left-0 w-1.5 rounded-l-lg" />
      )}
      {/* Compact view — always visible */}
      <div className="flex items-center gap-3 p-3">
        {/* Initiative */}
        {editingInit ? (
          <input
            type="number"
            step="any"
            value={initInput}
            onChange={e => setInitInput(e.target.value)}
            onBlur={() => {
              const val = parseFloat(initInput);
              if (!isNaN(val)) onSetInitiative(val);
              setEditingInit(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = parseFloat(initInput);
                if (!isNaN(val)) onSetInitiative(val);
                setEditingInit(false);
              }
              if (e.key === 'Escape') setEditingInit(false);
            }}
            className="bg-surface-raised text-heading h-10 w-12 rounded-lg text-center text-sm font-bold shadow-sm"
            autoFocus
          />
        ) : (
          <button
            onClick={() => {
              setInitInput(entity.initiative?.toString() ?? '');
              setEditingInit(true);
            }}
            className={`hover:ring-accent-amber-border flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums shadow-sm transition-all hover:ring-2 ${
              isCurrentTurn
                ? 'bg-accent-amber-bg-strong text-accent-amber-text ring-accent-amber-border ring-2'
                : 'bg-surface-raised text-heading'
            }`}
            title="Click to set initiative"
          >
            {entity.initiative != null
              ? Number.isInteger(entity.initiative)
                ? entity.initiative
                : entity.initiative.toFixed(1)
              : '—'}
          </button>
        )}

        {/* Chess piece (monsters/NPCs) or figurine color (players) */}
        {entity.type === 'player' && onChangePlayerColor && (
          <PlayerColorPicker
            color={entity.color}
            onChange={color => {
              onUpdate({ color });
              onChangePlayerColor(color);
            }}
          />
        )}
        {entity.type !== 'player' && entity.type !== 'lair' && (
          <ChessPiecePicker
            piece={entity.chessPiece}
            color={entity.color}
            onChangePiece={p => onUpdate({ chessPiece: p })}
            onChangeColor={c => onUpdate({ color: c })}
          />
        )}

        {/* Name + HP + Conditions */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {editingName ? (
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => {
                  const trimmed = nameInput.trim();
                  if (trimmed && trimmed !== entity.name)
                    onUpdate({ name: trimmed });
                  setEditingName(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const trimmed = nameInput.trim();
                    if (trimmed && trimmed !== entity.name)
                      onUpdate({ name: trimmed });
                    setEditingName(false);
                  }
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="text-heading bg-surface-raised max-w-[200px] min-w-0 rounded px-1.5 py-0.5 font-semibold shadow-sm"
                autoFocus
              />
            ) : (
              <span
                className={`text-heading truncate font-semibold ${isDead ? 'line-through' : ''} ${entity.type !== 'player' ? 'hover:text-body cursor-pointer rounded transition-colors' : ''}`}
                onClick={() => {
                  if (entity.type !== 'player') {
                    setNameInput(entity.name);
                    setEditingName(true);
                  }
                }}
                title={entity.type !== 'player' ? 'Click to rename' : undefined}
              >
                {entity.name}
              </span>
            )}
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-sm ${style.badgeBg} ${style.badge} ${style.border}`}
            >
              {entity.summonOwnerId
                ? 'Summon'
                : entity.type === 'npc'
                  ? 'NPC'
                  : entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
            </span>
            {(entity.type === 'player' || entity.summonOwnerId) && (
              <SyncIndicator lastSynced={lastSynced} />
            )}
            {entity.type === 'player' && (entity.inspirationCount ?? 0) > 0 && (
              <span
                className="bg-accent-amber-bg text-accent-amber-text inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                title={`${entity.inspirationCount} Inspiration`}
              >
                <Sparkles size={10} />
                {entity.inspirationCount}
              </span>
            )}
            {entity.hasUsedReaction && (
              <span
                className="bg-accent-red-bg text-accent-red-text inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                title="Reaction used"
              >
                <ClockAlert size={10} />
                Reaction
              </span>
            )}
            {entity.concentrationSpell && (
              <span className="bg-accent-orange-bg text-accent-orange-text shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium">
                <Brain size={10} className="mr-0.5 inline" />
                {entity.concentrationSpell}
              </span>
            )}
            {entity.type === 'npc' && entity.hitDice && (
              <span
                className="bg-accent-purple-bg text-accent-purple-text inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium"
                title={`Hit Dice: ${entity.hitDice.current}/${entity.hitDice.max} ${entity.hitDice.dieType}`}
              >
                HD {entity.hitDice.current}/{entity.hitDice.max}
              </span>
            )}
          </div>

          {/* HP Bar (skip for lair entities, optionally hidden for players) */}
          {entity.type !== 'lair' &&
            (hidePlayerHp && entity.type === 'player' ? (
              <div className="text-muted text-xs italic">HP hidden</div>
            ) : (
              <HPBar
                current={entity.currentHp}
                max={entity.maxHp}
                temp={entity.tempHp}
                size="sm"
              />
            ))}

          {/* Death Saving Throws (players & NPCs at 0 HP) */}
          {(entity.type === 'player' || entity.type === 'npc') &&
            entity.currentHp <= 0 &&
            entity.deathSaves && (
              <div className="mt-1 flex items-center gap-2">
                <Skull size={14} className="text-heading shrink-0" />
                {entity.deathSaves.isStabilized ? (
                  <span className="text-accent-amber-text bg-accent-amber-bg-strong rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    Stabilized
                  </span>
                ) : entity.deathSaves.failures >= 3 ? (
                  <span className="text-accent-red-text bg-accent-red-bg-strong rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    Dead
                  </span>
                ) : (
                  <>
                    <div
                      className="flex items-center gap-1.5"
                      title="Death save successes — click to toggle"
                    >
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                        S
                      </span>
                      {[1, 2, 3].map(i => {
                        const filled = i <= entity.deathSaves!.successes;
                        const isNpc = entity.type === 'npc';
                        return (
                          <span
                            key={`s-${i}`}
                            role={isNpc ? 'button' : undefined}
                            tabIndex={isNpc ? 0 : undefined}
                            onClick={
                              isNpc
                                ? e => {
                                    e.stopPropagation();
                                    const newSuccesses = filled ? i - 1 : i;
                                    const isStabilized = newSuccesses >= 3;
                                    onUpdate({
                                      deathSaves: {
                                        ...entity.deathSaves!,
                                        successes: newSuccesses,
                                        isStabilized,
                                      },
                                    });
                                  }
                                : undefined
                            }
                            className={`h-3.5 w-3.5 rounded-full border-2 ${
                              filled
                                ? 'border-green-500 bg-green-500'
                                : 'border-divider bg-surface-raised'
                            }${isNpc ? 'cursor-pointer hover:border-green-400' : ''}`}
                          />
                        );
                      })}
                    </div>
                    <div
                      className="flex items-center gap-1.5"
                      title="Death save failures — click to toggle"
                    >
                      <span className="text-xs font-semibold text-red-500 dark:text-red-400">
                        F
                      </span>
                      {[1, 2, 3].map(i => {
                        const filled = i <= entity.deathSaves!.failures;
                        const isNpc = entity.type === 'npc';
                        return (
                          <span
                            key={`f-${i}`}
                            role={isNpc ? 'button' : undefined}
                            tabIndex={isNpc ? 0 : undefined}
                            onClick={
                              isNpc
                                ? e => {
                                    e.stopPropagation();
                                    const newFailures = filled ? i - 1 : i;
                                    onUpdate({
                                      deathSaves: {
                                        ...entity.deathSaves!,
                                        failures: newFailures,
                                      },
                                    });
                                  }
                                : undefined
                            }
                            className={`h-3.5 w-3.5 rounded-full border-2 ${
                              filled
                                ? 'border-red-500 bg-red-500'
                                : 'border-divider bg-surface-raised'
                            }${isNpc ? 'cursor-pointer hover:border-red-400' : ''}`}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

          {/* Spend Hit Die (NPCs with remaining hit dice, not at 0 HP) */}
          {entity.type === 'npc' &&
            entity.hitDice &&
            entity.hitDice.current > 0 &&
            entity.currentHp > 0 &&
            entity.currentHp < entity.maxHp && (
              <button
                className="text-accent-purple-text bg-accent-purple-bg hover:bg-accent-purple-bg-strong mt-1 flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors"
                title={`Spend 1${entity.hitDice.dieType} + CON mod to heal`}
                onClick={e => {
                  e.stopPropagation();
                  const hd = entity.hitDice!;
                  // Roll the hit die
                  const dieMax = parseInt(hd.dieType.replace('d', ''), 10);
                  const roll = Math.floor(Math.random() * dieMax) + 1;
                  // Get CON modifier from stat block if available
                  const conMod = entity.monsterStatBlock
                    ? Math.floor((entity.monsterStatBlock.con - 10) / 2)
                    : 0;
                  const healing = Math.max(1, roll + conMod);
                  const newHp = Math.min(
                    entity.maxHp,
                    entity.currentHp + healing
                  );
                  onUpdate({
                    currentHp: newHp,
                    hitDice: { ...hd, current: hd.current - 1 },
                  });
                }}
              >
                <Plus size={10} />
                Spend Hit Die ({entity.hitDice.dieType})
              </button>
            )}

          {/* Lair actions quick display */}
          {entity.type === 'lair' && entity.lairActions && (
            <div className="flex gap-1">
              {entity.lairActions.map(la => (
                <span
                  key={la.id}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    la.usedThisRound
                      ? 'bg-surface-secondary text-faint line-through'
                      : 'bg-accent-emerald-bg text-accent-emerald-text'
                  }`}
                >
                  {la.name}
                </span>
              ))}
            </div>
          )}

          {/* Condition badges */}
          {entity.conditions.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {entity.conditions.map(c => (
                <ConditionBadge
                  key={c.id}
                  name={c.name}
                  stackCount={c.stackCount}
                  sourceSpell={c.sourceSpell}
                  onRemove={() => onRemoveCondition(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right side: AC + DM counter + controls */}
        <div className="flex shrink-0 items-center gap-2">
          {entity.type !== 'lair' && (
            <div className="bg-surface-raised text-heading flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm shadow-sm">
              <Shield size={14} />
              <span className="font-bold tabular-nums">
                {entity.armorClass}
              </span>
            </div>
          )}

          {customCounterLabel &&
            entity.type === 'player' &&
            onAdjustCounter && (
              <DmCounterControl
                label={customCounterLabel}
                value={counterValue}
                onAdjust={onAdjustCounter}
              />
            )}

          <div className="flex items-center gap-1">
            {entity.type === 'player' && onViewPlayer && (
              <button
                onClick={onViewPlayer}
                className="text-muted hover:text-accent-blue-text rounded p-1 transition-colors"
                title="View character details"
              >
                <Eye size={14} />
              </button>
            )}
            {entity.npcSourceId && onViewNPC && (
              <button
                onClick={onViewNPC}
                className="text-muted hover:text-accent-amber-text rounded p-1 transition-colors"
                title="View NPC details"
              >
                <Eye size={14} />
              </button>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted hover:text-body rounded p-1 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <EntityCardExpanded
          entity={entity}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onDamage={onDamage}
          onHeal={onHeal}
          onAddCondition={onAddCondition}
          onRemoveCondition={onRemoveCondition}
          onUseAbility={onUseAbility}
          onRestoreAbility={onRestoreAbility}
          onUseLegendaryAction={onUseLegendaryAction}
          onResetLegendaryActions={onResetLegendaryActions}
          onSetConcentration={onSetConcentration}
          onUseLairAction={onUseLairAction}
          onLongRest={onLongRest}
        />
      )}
    </div>
  );
}
