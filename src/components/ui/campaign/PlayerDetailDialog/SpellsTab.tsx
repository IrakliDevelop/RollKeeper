'use client';

import React, { useMemo, useState } from 'react';
import { Eye, Star } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { SlotPips } from '@/components/ui/game/SlotPips';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import { getTotalLevel } from '@/utils/multiclass';
import { ensureArray, formatMod, sentenceCase } from './shared';
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
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
  charisma: 'Charisma',
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

/** Slot pips plus a plain "available/total" count, as heading controls. */
function SlotTrailing({
  level,
  max,
  used,
}: {
  level: number | 'pact';
  max: number;
  used: number;
}) {
  const available = max - used;
  return (
    <>
      <SlotPips level={level} total={max} available={available} />
      <span aria-hidden="true" className="type-small text-muted tabular-nums">
        {available}/{max}
      </span>
    </>
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
    <li className="flex items-center gap-2 py-2 pointer-coarse:min-h-11">
      {markPrepared && isPrepared && (
        <span role="img" aria-label="Prepared" className="shrink-0">
          <Star
            className="text-brass-text size-3.5 fill-current"
            aria-hidden="true"
          />
        </span>
      )}
      <span
        className={`type-ui min-w-0 truncate ${
          dimmed ? 'text-muted' : 'text-heading'
        }`}
      >
        {spell.name}
      </span>
      {spell.school && spell.school !== 'Unknown' && (
        <span className="type-small text-muted hidden sm:inline">
          {spell.school}
        </span>
      )}
      {dimmed && (
        <Badge variant="neutral" size="sm">
          Not prepared
        </Badge>
      )}
      {spell.concentration && (
        <Badge variant="magic" size="sm">
          Concentration
        </Badge>
      )}
      {spell.ritual && (
        <Badge variant="neutral" size="sm">
          Ritual
        </Badge>
      )}
      {tags.map(tag => (
        <Badge key={tag} variant="neutral" size="sm">
          {tag}
        </Badge>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="ml-auto px-1.5"
        aria-label={`View ${spell.name}`}
        onClick={onView}
      >
        <Eye size={14} aria-hidden="true" />
      </Button>
    </li>
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

  const hasSpellcastingStats = !!char.spellcastingStats;
  const ability = hasSpellcastingStats
    ? getCharacterSpellcastingAbility(char)
    : null;
  const spellAttack = hasSpellcastingStats
    ? calculateSpellAttackBonus(char)
    : null;
  const spellDC = hasSpellcastingStats ? calculateSpellSaveDC(char) : null;
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
      <p className="type-body text-muted py-12 text-center">No spells synced</p>
    );
  }

  const statsParts: React.ReactNode[] = [];
  if (ability) {
    statsParts.push(ABILITY_LABEL_MAP[ability] ?? sentenceCase(ability));
  }
  if (spellAttack !== null) {
    statsParts.push(
      <>
        Spell attack{' '}
        <span className="tabular-nums">{formatMod(spellAttack)}</span>
      </>
    );
  }
  if (spellDC !== null) {
    statsParts.push(
      <>
        Spell save DC <span className="tabular-nums">{spellDC}</span>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/* Spellcasting stats: read-only, honors player overrides */}
      {statsParts.length > 0 && (
        <p className="type-ui text-body">
          {statsParts.map((part, index) => (
            <React.Fragment key={index}>
              {index > 0 && ' · '}
              {part}
            </React.Fragment>
          ))}
        </p>
      )}

      {/* Pact magic: separate from numbered levels */}
      {hasPact && pact && (
        <Section
          level={4}
          heading={`Pact magic, level ${pact.level}`}
          trailing={
            <SlotTrailing
              level="pact"
              max={pact.slots.max}
              used={pact.slots.used}
            />
          }
        />
      )}

      {sortedLevels.map(level => {
        const levelSpells = spellsByLevel[level] ?? [];
        const slot = level === 0 ? null : getSlot(char, level);

        return (
          <Section
            key={level}
            level={4}
            heading={LEVEL_NAMES[level] ?? `Level ${level}`}
            collapsed={collapsedLevels.has(level)}
            onCollapsedChange={() => toggleLevel(level)}
            trailing={
              slot && slot.max > 0 ? (
                <SlotTrailing level={level} max={slot.max} used={slot.used} />
              ) : undefined
            }
          >
            {levelSpells.length > 0 && (
              <ul className="divide-divider divide-y">
                {levelSpells.map(spell => (
                  <PlayerSpellRow
                    key={spell.id}
                    spell={spell}
                    showPreparedState={showPreparedState}
                    onView={() => setViewingSpell(spell)}
                  />
                ))}
              </ul>
            )}
          </Section>
        );
      })}

      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={!!viewingSpell}
          onClose={() => setViewingSpell(null)}
          characterLevel={getTotalLevel(char)}
        />
      )}
    </div>
  );
}
