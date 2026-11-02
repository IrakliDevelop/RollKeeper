'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/layout/card';
import { CombatTurnBar } from '@/components/ui/encounter/combat-screen/CombatTurnBar';
import { CombatantRow } from '@/components/ui/encounter/combat-screen/CombatantRow';
import type { EntityActions } from '@/components/ui/encounter/combat-screen/types';
import type { Encounter, EncounterEntity } from '@/types/encounter';
import { SAMPLE_ENCOUNTER } from './sampleEncounter';

const noop = () => {};

/**
 * The redesigned initiative list with a sample fight: step through turns and
 * damage or heal a creature. Nothing is saved.
 */
export function DemoInitiative() {
  const [encounter, setEncounter] = useState<Encounter>(SAMPLE_ENCOUNTER);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const actions = useMemo<EntityActions>(() => {
    const updateEntity = (
      id: string,
      change: (entity: EncounterEntity) => EncounterEntity
    ) =>
      setEncounter(prev => ({
        ...prev,
        entities: prev.entities.map(e => (e.id === id ? change(e) : e)),
      }));
    return {
      onUpdate: (id, updates) => updateEntity(id, e => ({ ...e, ...updates })),
      onDamage: (id, amount) =>
        updateEntity(id, e => ({
          ...e,
          currentHp: Math.max(0, e.currentHp - amount),
        })),
      onHeal: (id, amount) =>
        updateEntity(id, e => ({
          ...e,
          currentHp: Math.min(e.maxHp, e.currentHp + amount),
        })),
      onAddTempHp: (id, amount) =>
        updateEntity(id, e => ({ ...e, tempHp: Math.max(e.tempHp, amount) })),
      onRemoveCondition: (id, conditionId) =>
        updateEntity(id, e => ({
          ...e,
          conditions: e.conditions.filter(c => c.id !== conditionId),
        })),
      onRemove: noop,
      onSetMaxHp: noop,
      onAddCondition: noop,
      onSetConditionRounds: noop,
      onUseAbility: noop,
      onRestoreAbility: noop,
      onSpendResource: () => false,
      onRestoreResource: noop,
      onUseLegendaryAction: noop,
      onResetLegendaryActions: noop,
      onSetConcentration: noop,
      onUseLairAction: noop,
      onSetInitiative: noop,
      onLongRest: noop,
      onShortRest: noop,
    };
  }, []);

  const count = encounter.entities.length;
  const step = (delta: number) =>
    setEncounter(prev => {
      const next = prev.currentTurn + delta;
      if (next >= count)
        return { ...prev, currentTurn: 0, round: prev.round + 1 };
      if (next < 0)
        return prev.round > 1
          ? { ...prev, currentTurn: count - 1, round: prev.round - 1 }
          : prev;
      return { ...prev, currentTurn: next };
    });

  return (
    <Card padding="none" className="overflow-hidden">
      <CombatTurnBar
        encounter={encounter}
        layout="rail"
        hidePlayerHp={false}
        onStartCombat={noop}
        onNextTurn={() => step(1)}
        onPrevTurn={() => step(-1)}
        onRollAllInitiatives={noop}
        onRequestPlayerRolls={noop}
        requestActive={false}
        waitingNames={[]}
        canRequestRolls={false}
      />
      <ul className="divide-divider divide-y">
        {encounter.entities.map((entity, index) => (
          <li key={entity.id}>
            <CombatantRow
              entity={entity}
              density="rail"
              isActive={index === encounter.currentTurn}
              isOnDeck={index === (encounter.currentTurn + 1) % count}
              isSelected={entity.id === selectedId}
              hidePlayerHp={false}
              actions={actions}
              onSelect={() =>
                setSelectedId(id => (id === entity.id ? null : entity.id))
              }
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
