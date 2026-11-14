'use client';

import { useEffect, useRef, useState } from 'react';

import { Plus } from 'lucide-react';

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
import { AppIcon } from '@/components/ui/icons';
import { Tooltip } from '@/components/ui/primitives/Tooltip';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { ConditionBadge } from '@/components/shared/combat/ConditionBadge';
import { useCharacterStore } from '@/store/characterStore';

const QUICK_ADD_PALETTE = [...DEBUFF_PALETTE, ...BUFF_PALETTE];

const TRAY_HEIGHT_VAR = '--player-vtt-tray-height';

/**
 * Fixed top-right overlay surface for the player VTT screen: concentration
 * status and active conditions at a glance, plus a quick-add picker. All state
 * is store-local — reads/writes `characterStore` directly. Its Tooltip needs
 * the `TooltipProvider` that `PlayerVttScreen` wraps around the floating
 * panels. Below `xl` it sits under the tool island and publishes its own
 * height (plus an 8px gap) as `--player-vtt-tray-height` for the combat panel.
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      document.documentElement.style.setProperty(
        TRAY_HEIGHT_VAR,
        `${Math.ceil(root.getBoundingClientRect().height + 8)}px`
      );
    };
    update();
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(root);
    }
    return () => {
      observer?.disconnect();
      document.documentElement.style.removeProperty(TRAY_HEIGHT_VAR);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`${OVERLAY_SURFACE} pointer-events-auto fixed top-[var(--player-vtt-panel-top,78px)] right-4 z-10 flex max-w-[40vw] flex-wrap items-center gap-2 p-2 xl:top-3 xl:max-w-[300px]`}
    >
      {concentration.isConcentrating && (
        <Dialog open={concOpen} onOpenChange={setConcOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={
                <AppIcon
                  name="concentration"
                  className="text-lapis-text size-4"
                />
              }
            >
              Concentrating on {concentration.spellName}
            </Button>
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
        <ConditionBadge
          key={condition.id}
          name={condition.name}
          stackCount={condition.count}
          size="md"
          variant={condition.kind === 'buff' ? 'buff' : 'condition'}
          onRemove={() => removeCondition(condition.id)}
        />
      ))}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <Tooltip content="Add condition">
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-9 shrink-0 px-0"
              aria-label="Add condition"
            >
              <Plus size={16} aria-hidden />
            </Button>
          </DialogTrigger>
        </Tooltip>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Add condition or buff</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {QUICK_ADD_PALETTE.map(entry => (
              <Button
                key={entry.name}
                variant="secondary"
                size="sm"
                onClick={() => {
                  addCondition(
                    entry.name,
                    'Self',
                    entry.kind === 'buff' ? 'Buff added by player' : '',
                    1,
                    undefined,
                    undefined,
                    entry.kind
                  );
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
