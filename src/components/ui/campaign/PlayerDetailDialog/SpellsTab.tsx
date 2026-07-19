'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Eye, Star, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { ensureArray, formatMod } from './shared';
import {
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  getCharacterSpellcastingAbility,
} from '@/utils/calculations';
import type { CharacterState, Spell, SpellSlot } from '@/types/character';

const LEVEL_NAMES: Record<number, string> = {
  0: 'Cantrips',
  1: 'Level 1',
  2: 'Level 2',
  3: 'Level 3',
  4: 'Level 4',
  5: 'Level 5',
  6: 'Level 6',
  7: 'Level 7',
  8: 'Level 8',
  9: 'Level 9',
};

const ABILITY_LABEL_MAP: Record<string, string> = {
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

function isValidSlot(value: unknown): value is SpellSlot {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SpellSlot).max === 'number' &&
    typeof (value as SpellSlot).used === 'number'
  );
}

function getSlot(char: CharacterState, level: number): SpellSlot | null {
  const slots = char.spellSlots;
  if (!slots || typeof slots !== 'object') return null;
  const slot = (slots as unknown as Record<number, unknown>)[level];
  return isValidSlot(slot) ? slot : null;
}

/** Tab visibility rule: caster in any observable sense. */
export function characterHasSpellsToShow(char: CharacterState): boolean {
  if (ensureArray<Spell>(char.spells).length > 0) return true;
  for (let level = 1; level <= 9; level++) {
    const slot = getSlot(char, level);
    if (slot && slot.max > 0) return true;
  }
  return (char.pactMagic?.slots.max ?? 0) > 0;
}

/** Read-only slot pips — presentational divs, no click handlers. */
function SlotDots({ max, used }: { max: number; used: number }) {
  const remaining = max - used;
  return (
    <div className="ml-auto flex items-center gap-1.5">
      <div className="flex gap-1">
        {Array.from({ length: max }, (_, index) => {
          const isUsed = index < used;
          return (
            <div
              key={index}
              className={`h-4 w-4 rounded-full border-2 ${
                isUsed
                  ? 'border-red-500 bg-red-500 opacity-70'
                  : 'border-emerald-400 bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]'
              }`}
              title={`Slot ${index + 1} — ${isUsed ? 'Used' : 'Available'}`}
            />
          );
        })}
      </div>
      <span
        className={`text-[10px] font-bold ${
          remaining === 0 ? 'text-accent-red-text' : 'text-heading'
        }`}
      >
        {remaining}/{max}
      </span>
    </div>
  );
}

function PlayerSpellRow({
  spell,
  showPreparedState,
  onView,
}: {
  spell: Spell;
  showPreparedState: boolean;
  onView: () => void;
}) {
  const isCantrip = spell.level === 0;
  const isPrepared = !!spell.isPrepared || !!spell.isAlwaysPrepared;
  const markPrepared = showPreparedState && !isCantrip;
  const dimmed = markPrepared && !isPrepared;
  const tags = spell.tags ?? [];

  return (
    <div className="bg-surface-raised space-y-0.5 px-3 py-1.5">
      <div className="flex items-center gap-2">
        {markPrepared && isPrepared && (
          <Star className="text-accent-amber-text h-3.5 w-3.5 shrink-0 fill-current" />
        )}
        <span
          className={`min-w-0 flex-1 truncate text-sm font-medium ${
            dimmed ? 'text-muted' : 'text-heading'
          }`}
        >
          {spell.name}
        </span>
        <Badge variant={isCantrip ? 'warning' : 'secondary'} size="sm">
          {isCantrip ? 'C' : `L${spell.level}`}
        </Badge>
        {spell.school && spell.school !== 'Unknown' && (
          <span className="text-faint hidden text-xs sm:inline">
            {spell.school}
          </span>
        )}
        {dimmed && (
          <Badge variant="neutral" size="sm">
            Not prepared
          </Badge>
        )}
        {spell.concentration && (
          <Badge variant="info" size="sm">
            C
          </Badge>
        )}
        {spell.ritual && (
          <Badge variant="neutral" size="sm">
            R
          </Badge>
        )}
        <button
          type="button"
          onClick={onView}
          className="text-muted hover:text-accent-blue-text rounded p-1 transition-colors"
          title="View spell details"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-5">
          {tags.map(tag => (
            <span
              key={tag}
              className="border-accent-amber-border bg-accent-amber-bg text-accent-amber-text rounded border px-1.5 py-0 text-[10px] font-medium"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface SpellsTabProps {
  char: CharacterState;
}

export function SpellsTab({ char }: SpellsTabProps) {
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(
    () => new Set()
  );
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);

  const spells = useMemo(() => ensureArray<Spell>(char.spells), [char.spells]);

  const spellsByLevel = useMemo(() => {
    const groups: Record<number, Spell[]> = {};
    for (const spell of spells) {
      const lvl = spell.level;
      if (!groups[lvl]) groups[lvl] = [];
      groups[lvl].push(spell);
    }
    return groups;
  }, [spells]);

  // Spell levels union levels that have slots, so empty-but-slotted levels show
  const sortedLevels = useMemo(() => {
    const levels = new Set(Object.keys(spellsByLevel).map(Number));
    for (let level = 1; level <= 9; level++) {
      const slot = getSlot(char, level);
      if (slot && slot.max > 0) levels.add(level);
    }
    return Array.from(levels).sort((a, b) => a - b);
  }, [spellsByLevel, char]);

  // Prepared marking only when the character actually uses preparation
  const showPreparedState = useMemo(
    () =>
      spells.some(
        s => s.level > 0 && (s.isPrepared !== undefined || !!s.isAlwaysPrepared)
      ),
    [spells]
  );

  const ability = getCharacterSpellcastingAbility(char);
  const spellAttack = calculateSpellAttackBonus(char);
  const spellDC = calculateSpellSaveDC(char);
  const pact = char.pactMagic;
  const hasPact = (pact?.slots.max ?? 0) > 0;

  const toggleLevel = (level: number) => {
    setCollapsedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  };

  if (sortedLevels.length === 0 && !hasPact) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Wand2 className="text-faint mb-2 h-8 w-8" />
        <p className="text-muted text-sm">No spells synced</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Spellcasting stats — read-only, honors player overrides */}
      <div className="flex flex-wrap items-center gap-1.5">
        {ability && (
          <Badge variant="neutral" size="sm">
            {ABILITY_LABEL_MAP[ability] ?? ability}
          </Badge>
        )}
        {spellAttack !== null && (
          <Badge variant="info" size="sm">
            Spell Attack: {formatMod(spellAttack)}
          </Badge>
        )}
        {spellDC !== null && (
          <Badge variant="warning" size="sm">
            Save DC: {spellDC}
          </Badge>
        )}
      </div>

      {/* Pact magic — separate from numbered levels */}
      {hasPact && pact && (
        <div className="border-accent-purple-border overflow-hidden rounded-lg border-2">
          <div className="bg-accent-purple-bg flex w-full items-center gap-2 px-3 py-2">
            <span className="text-accent-purple-text text-sm font-semibold">
              Pact Magic (Lv {pact.level})
            </span>
            <SlotDots max={pact.slots.max} used={pact.slots.used} />
          </div>
        </div>
      )}

      {/* Level groups */}
      <div className="space-y-2">
        {sortedLevels.map(level => {
          const levelSpells = spellsByLevel[level] ?? [];
          const isCollapsed = collapsedLevels.has(level);
          const isCantrip = level === 0;
          const slot = isCantrip ? null : getSlot(char, level);
          const hasSlots = !!slot && slot.max > 0;

          return (
            <div
              key={level}
              className={`overflow-hidden rounded-lg border-2 ${
                isCantrip
                  ? 'border-accent-amber-border'
                  : 'border-accent-purple-border'
              }`}
            >
              <div
                className={`flex w-full items-center gap-2 px-3 py-2 ${
                  isCantrip ? 'bg-accent-amber-bg' : 'bg-accent-purple-bg'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleLevel(level)}
                  className="flex items-center gap-2"
                >
                  {isCollapsed ? (
                    <ChevronRight
                      className={`h-4 w-4 ${isCantrip ? 'text-accent-amber-text' : 'text-accent-purple-text'}`}
                    />
                  ) : (
                    <ChevronDown
                      className={`h-4 w-4 ${isCantrip ? 'text-accent-amber-text' : 'text-accent-purple-text'}`}
                    />
                  )}
                  <span
                    className={`text-sm font-semibold ${isCantrip ? 'text-accent-amber-text' : 'text-accent-purple-text'}`}
                  >
                    {LEVEL_NAMES[level] ?? `Level ${level}`}
                  </span>
                  {levelSpells.length > 0 && (
                    <Badge
                      variant={isCantrip ? 'warning' : 'secondary'}
                      size="sm"
                    >
                      {levelSpells.length}
                    </Badge>
                  )}
                </button>
                {hasSlots && slot && (
                  <SlotDots max={slot.max} used={slot.used} />
                )}
              </div>

              {!isCollapsed && levelSpells.length > 0 && (
                <div className="divide-y divide-[var(--border-divider)]">
                  {levelSpells.map(spell => (
                    <PlayerSpellRow
                      key={spell.id}
                      spell={spell}
                      showPreparedState={showPreparedState}
                      onView={() => setViewingSpell(spell)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={!!viewingSpell}
          onClose={() => setViewingSpell(null)}
        />
      )}
    </div>
  );
}
