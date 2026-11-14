'use client';

import React from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { ConcentrationReaction } from '@/components/ui/encounter/combat-screen/detail/ConcentrationReaction';
import { DeathSaves } from '@/components/ui/encounter/combat-screen/detail/DeathSaves';
import {
  canSpendHitDie,
  showDeathSaves,
  spendHitDie,
} from '@/components/ui/encounter/combat-screen/detail/hitDie';

import { CreatureConcentrationBanner } from './CreatureConcentrationBanner';
import type { CreatureVitalsProps } from './CreatureDrawer.utils';

/** "Status" section: concentration/reaction, death saves (when applicable), and Spend hit die. */
export function CreatureStatusRow({ entity, actions }: CreatureVitalsProps) {
  return (
    <Section level={4} heading="Status" contentClassName="space-y-2">
      <ConcentrationReaction entity={entity} actions={actions} />
      <CreatureConcentrationBanner entity={entity} />

      {showDeathSaves(entity) && (
        <DeathSaves entity={entity} actions={actions} />
      )}

      {canSpendHitDie(entity) && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => spendHitDie(entity, actions)}
        >
          Spend hit die ({entity.hitDice?.dieType})
        </Button>
      )}
    </Section>
  );
}
