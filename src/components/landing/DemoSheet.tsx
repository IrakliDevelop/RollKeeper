'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Card } from '@/components/ui/layout/card';
import { AcShield } from '@/components/ui/game/AcShield';
import { DemoAbilities } from './DemoAbilities';
import { DemoHitPoints } from './DemoHitPoints';
import { DemoSlots } from './DemoSlots';
import {
  DEMO_DAMAGE,
  DEMO_HEALING,
  DEMO_TEMP_HP,
  SAMPLE_CHARACTER,
  type DemoSheetState,
  type DemoSlotLevel,
} from './sampleCharacter';

type Hp = DemoSheetState['hp'];

/** Temp HP absorbs damage first; current HP never drops below 0. */
function takeDamage(hp: Hp, damage: number): Hp {
  const fromTemp = Math.min(hp.temporary, damage);
  return {
    ...hp,
    temporary: hp.temporary - fromTemp,
    current: Math.max(0, hp.current - (damage - fromTemp)),
  };
}

const heal = (hp: Hp, amount: number): Hp => ({
  ...hp,
  current: Math.min(hp.max, hp.current + amount),
});

const addTemp = (hp: Hp, amount: number): Hp => ({
  ...hp,
  temporary: Math.max(hp.temporary, amount),
});

function longRest(sheet: DemoSheetState): DemoSheetState {
  return {
    ...sheet,
    hp: { ...sheet.hp, current: sheet.hp.max, temporary: 0 },
    slots: {
      1: { ...sheet.slots[1], used: 0 },
      2: { ...sheet.slots[2], used: 0 },
      3: { ...sheet.slots[3], used: 0 },
    },
  };
}

/**
 * A small, working piece of the character sheet for the landing page. The
 * sample character lives in this component's state only: nothing is saved,
 * and reloading the page starts it over.
 */
export function DemoSheet() {
  const [sheet, setSheet] = useState<DemoSheetState>(SAMPLE_CHARACTER);
  const updateHp = (change: (hp: Hp) => Hp) =>
    setSheet(prev => ({ ...prev, hp: change(prev.hp) }));
  const changeSlot = (level: DemoSlotLevel, delta: number) =>
    setSheet(prev => {
      const slot = prev.slots[level];
      const used = Math.min(slot.max, Math.max(0, slot.used + delta));
      return { ...prev, slots: { ...prev.slots, [level]: { ...slot, used } } };
    });

  return (
    <Card padding="none">
      <div className="border-divider border-b px-4 py-3 sm:px-5">
        <h2 className="type-subheading text-heading">{sheet.name}</h2>
        <p className="type-small text-muted">
          Level {sheet.level} {sheet.className.toLowerCase()}
        </p>
        <p className="type-small text-muted mt-2">
          A sample character to try: take damage or spend a spell slot. Nothing
          here is saved.
        </p>
      </div>

      <div className="flex flex-col gap-6 px-4 py-4 sm:px-5">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <DemoHitPoints {...sheet.hp} />
          </div>
          <div className="flex flex-col items-center gap-1">
            <AcShield value={sheet.ac} />
            <span className="type-caption text-muted">AC</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="danger"
            onClick={() => updateHp(hp => takeDamage(hp, DEMO_DAMAGE))}
          >
            Take {DEMO_DAMAGE} damage
          </Button>
          <Button onClick={() => updateHp(hp => heal(hp, DEMO_HEALING))}>
            Heal {DEMO_HEALING}
          </Button>
          <Button onClick={() => updateHp(hp => addTemp(hp, DEMO_TEMP_HP))}>
            Add {DEMO_TEMP_HP} temp HP
          </Button>
        </div>

        <DemoSlots slots={sheet.slots} onChange={changeSlot} />

        <DemoAbilities
          abilities={sheet.abilities}
          saveProficient={sheet.saveProficient}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            selected={sheet.inspired}
            aria-pressed={sheet.inspired}
            onClick={() => setSheet(p => ({ ...p, inspired: !p.inspired }))}
          >
            Heroic inspiration
          </Button>
          <Button onClick={() => setSheet(longRest)}>Take a long rest</Button>
        </div>
      </div>
    </Card>
  );
}
