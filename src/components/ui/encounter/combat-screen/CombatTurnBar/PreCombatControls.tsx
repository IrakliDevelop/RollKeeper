'use client';

import React from 'react';
import { Play, Dices } from 'lucide-react';
import type { CombatTurnBarProps } from './index';
import { Button } from '@/components/ui/forms/button';

export function PreCombatControls({
  encounter,
  onStartCombat,
  onRollAllInitiatives,
}: Pick<
  CombatTurnBarProps,
  'encounter' | 'onStartCombat' | 'onRollAllInitiatives'
>) {
  const isEmpty = encounter.entities.length === 0;
  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={onStartCombat}
        disabled={isEmpty}
        leftIcon={<Play size={16} />}
      >
        Start Combat
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRollAllInitiatives}
        disabled={isEmpty}
        leftIcon={<Dices size={16} />}
      >
        Roll Initiatives (NPCs/Monsters)
      </Button>
    </>
  );
}
