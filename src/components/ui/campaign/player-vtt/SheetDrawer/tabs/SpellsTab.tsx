'use client';

import { useMemo, useState } from 'react';

import type { ToastData } from '@/components/ui/feedback/Toast';
import { Input } from '@/components/ui/forms/input';
import { useCharacterStore } from '@/store/characterStore';
import {
  calculateSpellAttackBonus,
  calculateSpellSaveDC,
  getCharacterSpellcastingAbility,
} from '@/utils/calculations';

import { useDockSpellCasting } from '../../CharacterDock/DockSpells.hooks';
import { SpellcastingStatsRow } from '../../CharacterDock/SpellcastingStatsRow';
import { MaybeRollElement } from '../MaybeRollElement';
import { buildSpellGroups } from '../SheetTabs.utils';
import type { SheetRoll, SheetSpellCastingProps } from '../SheetDrawer.types';
import { SLOT_ORDINAL, SpellGroupList } from './SpellGroupList';
import { SpellSlotPipsRow } from './SpellSlotPipsRow';
import { SpellsTabModals } from './SpellsTabModals';

export interface SpellsTabProps {
  locked: boolean;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  spellCasting: SheetSpellCastingProps;
  roll?: SheetRoll;
}

/** Sheet drawer's Spells tab: search, per-level groups with tappable slot pips, prepare/cast flow. */
export function SpellsTab({
  locked,
  addToast,
  spellCasting,
  roll,
}: SpellsTabProps) {
  const character = useCharacterStore(s => s.character);
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const spendSpellSlot = useCharacterStore(s => s.spendSpellSlot);
  const restoreSpellSlot = useCharacterStore(s => s.restoreSpellSlot);
  const spendPactMagicSlot = useCharacterStore(s => s.spendPactMagicSlot);
  const restorePactMagicSlot = useCharacterStore(s => s.restorePactMagicSlot);

  const {
    castingSpell,
    viewingSpell,
    setViewingSpell,
    handleCastClick,
    handleModalCast,
    closeCastModal,
    closeDetailsModal,
  } = useDockSpellCasting({ addToast, ...spellCasting });

  const [search, setSearch] = useState('');
  const groups = useMemo(
    () => buildSpellGroups(character, search),
    [character, search]
  );

  const spellcastingAbility = getCharacterSpellcastingAbility(character);
  const spellAttackBonus = calculateSpellAttackBonus(character);
  const spellSaveDC = calculateSpellSaveDC(character);
  const pactMagic = character.pactMagic;

  const togglePrepared = (id: string) => {
    // Read fresh state rather than the render snapshot — this can fire after
    // other spell-slot mutations landed via `useCharacterStore.getState()`
    // elsewhere in the same tick.
    const freshSpells = useCharacterStore.getState().character.spells;
    updateCharacter({
      spells: freshSpells.map(s =>
        s.id === id
          ? {
              ...s,
              isPrepared: !s.isPrepared,
              updatedAt: new Date().toISOString(),
            }
          : s
      ),
    });
  };

  return (
    <div className="space-y-3">
      <MaybeRollElement
        ariaLabel="Roll spell attack"
        className=""
        onRoll={
          roll ? () => roll('Spell Attack', spellAttackBonus ?? 0) : undefined
        }
      >
        <SpellcastingStatsRow
          spellAttackBonus={spellAttackBonus}
          spellSaveDC={spellSaveDC}
          abilityLabel={(spellcastingAbility ?? '').slice(0, 3).toUpperCase()}
        />
      </MaybeRollElement>

      <Input
        type="search"
        aria-label="Search spells"
        placeholder="Search spells…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {pactMagic && pactMagic.slots.max > 0 && (
        <SpellSlotPipsRow
          heading={`Pact slots (${SLOT_ORDINAL[pactMagic.level] ?? pactMagic.level} level)`}
          max={pactMagic.slots.max}
          used={pactMagic.slots.used}
          spendLabel="Spend pact slot"
          restoreLabel="Restore pact slot"
          onSpend={() => spendPactMagicSlot(1)}
          onRestore={() => restorePactMagicSlot(1)}
        />
      )}

      <SpellGroupList
        spellsCount={character.spells.length}
        search={search}
        groups={groups}
        locked={locked}
        onSpendSlot={level => spendSpellSlot(level, 1)}
        onRestoreSlot={level => restoreSpellSlot(level, 1)}
        onTogglePrepared={togglePrepared}
        onCast={handleCastClick}
        onView={setViewingSpell}
      />

      <SpellsTabModals
        character={character}
        castingSpell={castingSpell}
        viewingSpell={viewingSpell}
        closeCastModal={closeCastModal}
        closeDetailsModal={closeDetailsModal}
        handleModalCast={handleModalCast}
        handleCastClick={handleCastClick}
        addToast={addToast}
      />
    </div>
  );
}
