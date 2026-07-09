'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/feedback/dialog';
import {
  BUFF_PALETTE,
  DEBUFF_PALETTE,
} from '@/components/ui/encounter/combat-screen/effectPalettes';
import { Button } from '@/components/ui/forms/button';
import { ConditionBadge } from '@/components/shared/combat/ConditionBadge';
import { useCharacterStore } from '@/store/characterStore';

const QUICK_ADD_PALETTE = [...DEBUFF_PALETTE, ...BUFF_PALETTE];

/**
 * Fixed top-right pill row for the player VTT screen: concentration status
 * and active conditions at a glance, plus a quick-add picker. All state is
 * store-local — reads/writes `characterStore` directly.
 */
export function StatusEffectTray() {
  const concentration = useCharacterStore(s => s.character.concentration);
  const activeConditions = useCharacterStore(
    s => s.character.conditionsAndDiseases.activeConditions
  );
  const stopConcentration = useCharacterStore(s => s.stopConcentration);
  const removeCondition = useCharacterStore(s => s.removeCondition);
  const addCondition = useCharacterStore(s => s.addCondition);

  const [concOpen, setConcOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="bg-surface-raised border-divider pointer-events-auto fixed top-3 right-4 z-10 flex max-w-[40vw] flex-wrap gap-2 rounded-2xl border p-2 shadow-lg">
      {concentration.isConcentrating && (
        <Dialog open={concOpen} onOpenChange={setConcOpen}>
          <DialogTrigger asChild>
            <button className="bg-accent-amber-bg border-accent-amber-border text-accent-amber-text flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-xs font-semibold">
              🧠 CON
            </button>
          </DialogTrigger>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>
                Concentrating on {concentration.spellName}
              </DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="danger"
                size="lg"
                onClick={() => {
                  stopConcentration();
                  setConcOpen(false);
                }}
              >
                End concentration
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {activeConditions.map(condition => (
        <div key={condition.id} className="flex min-h-[30px] items-center">
          <ConditionBadge
            name={condition.name}
            stackCount={condition.count}
            sourceSpell={condition.source}
            size="md"
            onRemove={() => removeCondition(condition.id)}
          />
        </div>
      ))}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger asChild>
          <button
            aria-label="Add condition"
            className="border-divider text-faint flex min-h-[30px] min-w-[30px] items-center justify-center rounded-full border border-dashed"
          >
            +
          </button>
        </DialogTrigger>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Add condition or buff</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUICK_ADD_PALETTE.map(entry => (
              <Button
                key={entry.name}
                variant="outline"
                size="lg"
                onClick={() => {
                  addCondition(entry.name, 'Self', '', 1);
                  setAddOpen(false);
                }}
              >
                {entry.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
