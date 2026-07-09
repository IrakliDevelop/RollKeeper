'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/forms/input';
import { SpellCastModal } from '@/components/ui/game/SpellCastModal';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import type { ToastData } from '@/components/ui/feedback/Toast';
import { useCharacterStore } from '@/store/characterStore';
import {
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  getCharacterSpellcastingAbility,
} from '@/utils/calculations';
import type { SpellSlots } from '@/types/character';
import type { SpellAoe } from '@/types/spellAoe';

import { useDockSpellCasting } from './DockSpells.hooks';
import { groupSpellsByLevel } from './DockSpells.utils';
import { SpellLevelGroup } from './SpellLevelGroup';
import { SpellcastingStatsRow } from './SpellcastingStatsRow';

export interface DockSpellsProps {
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  /** Ask the screen to arm template placement (only called when spell.aoe && connectionLive). */
  onCastPlacement: (spellName: string, aoe: NonNullable<SpellAoe>) => void;
  connectionLive: boolean;
  hasPendingPlacement: boolean;
  onCancelPlacement: () => void;
}

/** Dock's Spells section: search, per-level groups with slot pips, and the cast flow. */
export function DockSpells(props: DockSpellsProps) {
  const { character } = useCharacterStore();
  const {
    castingSpell,
    viewingSpell,
    setViewingSpell,
    handleCastClick,
    handleModalCast,
    closeCastModal,
    closeDetailsModal,
  } = useDockSpellCasting(props);

  const [search, setSearch] = useState('');
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(
    new Set()
  );

  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  const spellAttackBonus = calculateSpellAttackBonus(character);
  const spellSaveDC = calculateSpellSaveDC(character);

  const filteredSpells = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return character.spells;
    return character.spells.filter(spell =>
      spell.name.toLowerCase().includes(query)
    );
  }, [character.spells, search]);

  const groups = useMemo(
    () => groupSpellsByLevel(filteredSpells),
    [filteredSpells]
  );

  if (spellcastingAbility === null || character.spells.length === 0) {
    return null;
  }

  const toggleLevel = (level: number) => {
    setCollapsedLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <SpellcastingStatsRow
        spellAttackBonus={spellAttackBonus}
        spellSaveDC={spellSaveDC}
        abilityLabel={spellcastingAbility.slice(0, 3).toUpperCase()}
      />

      <Input
        aria-label="Search spells"
        placeholder="Search spells…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="space-y-2">
        {groups.map(([level, spells]) => (
          <SpellLevelGroup
            key={level}
            level={level}
            spells={spells}
            slot={
              level > 0 ? character.spellSlots[level as keyof SpellSlots] : null
            }
            collapsed={collapsedLevels.has(level)}
            onToggle={() => toggleLevel(level)}
            onView={setViewingSpell}
            onCast={handleCastClick}
          />
        ))}
      </div>

      {castingSpell && (
        <SpellCastModal
          isOpen
          onClose={closeCastModal}
          spell={castingSpell}
          spellSlots={character.spellSlots}
          concentration={character.concentration}
          pactMagic={character.pactMagic}
          hasUsedReaction={character.reaction?.hasUsedReaction}
          onCastSpell={handleModalCast}
        />
      )}

      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen
          onClose={closeDetailsModal}
          onCast={() => handleCastClick(viewingSpell)}
        />
      )}
    </div>
  );
}
