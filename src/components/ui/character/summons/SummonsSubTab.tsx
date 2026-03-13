'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { SummonCard } from './SummonCard';

export function SummonsSubTab() {
  const character = useCharacterStore(state => state.character);
  const damageSummon = useCharacterStore(state => state.damageSummon);
  const healSummon = useCharacterStore(state => state.healSummon);
  const addSummonTempHp = useCharacterStore(state => state.addSummonTempHp);
  const addSummonCondition = useCharacterStore(
    state => state.addSummonCondition
  );
  const removeSummonCondition = useCharacterStore(
    state => state.removeSummonCondition
  );
  const removeSummon = useCharacterStore(state => state.removeSummon);

  const summons = character.summons || [];

  if (summons.length === 0) {
    return (
      <div className="border-divider bg-surface-raised rounded-lg border p-8 text-center">
        <Sparkles className="text-muted mx-auto mb-3 h-10 w-10" />
        <h3 className="text-heading mb-1 text-sm font-semibold">
          No Active Summons
        </h3>
        <p className="text-muted text-xs">
          Cast a summoning spell (like Find Familiar or Summon Beast) from the
          Spells tab to summon a creature here.
        </p>
      </div>
    );
  }

  const familiars = summons.filter(s => s.type === 'familiar');
  const concentrationSummons = summons.filter(
    s => s.type === 'summon' && s.requiresConcentration
  );
  const otherSummons = summons.filter(
    s => s.type === 'summon' && !s.requiresConcentration
  );

  return (
    <div className="space-y-3">
      {familiars.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted text-xs font-medium tracking-wider uppercase">
            Familiars
          </h4>
          {familiars.map(s => (
            <SummonCard
              key={s.id}
              summon={s}
              onDamage={damageSummon}
              onHeal={healSummon}
              onAddTempHp={addSummonTempHp}
              onAddCondition={addSummonCondition}
              onRemoveCondition={removeSummonCondition}
              onDismiss={removeSummon}
            />
          ))}
        </div>
      )}

      {concentrationSummons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted text-xs font-medium tracking-wider uppercase">
            Concentration Summons
          </h4>
          {concentrationSummons.map(s => (
            <SummonCard
              key={s.id}
              summon={s}
              onDamage={damageSummon}
              onHeal={healSummon}
              onAddTempHp={addSummonTempHp}
              onAddCondition={addSummonCondition}
              onRemoveCondition={removeSummonCondition}
              onDismiss={removeSummon}
            />
          ))}
        </div>
      )}

      {otherSummons.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted text-xs font-medium tracking-wider uppercase">
            Other Summons
          </h4>
          {otherSummons.map(s => (
            <SummonCard
              key={s.id}
              summon={s}
              onDamage={damageSummon}
              onHeal={healSummon}
              onAddTempHp={addSummonTempHp}
              onAddCondition={addSummonCondition}
              onRemoveCondition={removeSummonCondition}
              onDismiss={removeSummon}
            />
          ))}
        </div>
      )}
    </div>
  );
}
