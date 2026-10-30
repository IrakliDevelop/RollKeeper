'use client';

import React, { useState } from 'react';
import { ClockAlert } from 'lucide-react';
import type {
  Spell,
  SpellSlots,
  ConcentrationState,
  PactMagic,
} from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { Badge } from '@/components/ui/layout/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';

/** Slot levels at or above the spell's level with a slot left, as "1,3". */
function availableLevelsKey(spellLevel: number, spellSlots: SpellSlots) {
  const levels: number[] = [];
  for (let level = Math.max(1, spellLevel); level <= 9; level++) {
    const slot = spellSlots[level as keyof SpellSlots];
    if (slot.max > 0 && slot.used < slot.max) levels.push(level);
  }
  return levels.join(',');
}

interface SpellCastModalProps {
  isOpen: boolean;
  onClose: () => void;
  spell: Spell;
  spellSlots: SpellSlots;
  concentration: ConcentrationState;
  hasUsedReaction?: boolean;
  onCastSpell: (
    spellLevel: number,
    useFreecast: boolean,
    isRitual?: boolean,
    usePact?: boolean
  ) => void;
  onResetReaction?: () => void;
  /** Fired on confirmed cast of a reaction-speed spell while the reaction was still available. */
  onReactionSpellCast?: () => void;
  pactMagic?: PactMagic | null;
}

export function SpellCastModal({
  isOpen,
  onClose,
  spell,
  spellSlots,
  concentration,
  hasUsedReaction,
  onCastSpell,
  onResetReaction,
  onReactionSpellCast,
  pactMagic,
}: SpellCastModalProps) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [useFreecast, setUseFreecast] = useState(false);
  const [useRitual, setUseRitual] = useState(false);
  const [usePact, setUsePact] = useState(false);

  const isAtWill = spell.freeCastMax === 0;
  const isInnate = spell.freeCastMax !== undefined && spell.freeCastMax > 0;
  const hasFreeCasting = isAtWill || isInnate;
  const freeCastsRemaining = isInnate
    ? spell.freeCastMax! - (spell.freeCastsUsed || 0)
    : 0;
  const canFreecast = isAtWill || (isInnate && freeCastsRemaining > 0);
  const canRitual = spell.ritual === true && spell.level > 0;
  const pactAvailable =
    !!pactMagic && pactMagic.slots.max > 0 && pactMagic.level >= spell.level;
  const pactRemaining = pactMagic
    ? pactMagic.slots.max - pactMagic.slots.used
    : 0;
  const canPact = pactAvailable && pactRemaining > 0;

  // Keyed on the level list, not the spellSlots object: a sync from another
  // tab replaces that object and must not reset the player's choice.
  const levelsKey = availableLevelsKey(spell.level, spellSlots);
  const availableLevels = React.useMemo(
    () => (levelsKey ? levelsKey.split(',').map(Number) : []),
    [levelsKey]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    setUseRitual(false);
    setUsePact(false);
    if (spell.level === 0) {
      setSelectedLevel(0);
      setUseFreecast(false);
    } else if (canFreecast) {
      setSelectedLevel(spell.level);
      setUseFreecast(true);
    } else if (availableLevels.length > 0) {
      setSelectedLevel(
        availableLevels.includes(spell.level) ? spell.level : availableLevels[0]
      );
      setUseFreecast(false);
    } else {
      setSelectedLevel(null);
      setUseFreecast(false);
    }
  }, [isOpen, spell.level, spell.freeCastMax, canFreecast, availableLevels]);

  const isReactionSpell = spell.castingTime?.toLowerCase().includes('reaction');
  const reactionWarning = isReactionSpell && hasUsedReaction;
  const concentrationWarning =
    spell.concentration && concentration.isConcentrating;
  const canCast =
    selectedLevel !== null &&
    (spell.level === 0 ||
      useFreecast ||
      useRitual ||
      usePact ||
      availableLevels.includes(selectedLevel));
  const selectedChoice = useFreecast
    ? 'free'
    : useRitual
      ? 'ritual'
      : usePact
        ? 'pact'
        : selectedLevel !== null
          ? `slot-${selectedLevel}`
          : '';

  const handleSelectFreecast = () => {
    setUseFreecast(true);
    setUseRitual(false);
    setUsePact(false);
    setSelectedLevel(spell.level);
  };
  const handleSelectSlot = (level: number) => {
    setUseFreecast(false);
    setUseRitual(false);
    setUsePact(false);
    setSelectedLevel(level);
  };
  const handleSelectRitual = () => {
    setUseRitual(true);
    setUseFreecast(false);
    setUsePact(false);
    setSelectedLevel(spell.level);
  };
  const handleSelectPact = () => {
    setUsePact(true);
    setUseRitual(false);
    setUseFreecast(false);
    setSelectedLevel(pactMagic!.level);
  };
  const handleClose = () => {
    onClose();
    setSelectedLevel(null);
    setUseFreecast(false);
    setUseRitual(false);
    setUsePact(false);
  };
  const handleCast = () => {
    if (!canCast || selectedLevel === null) return;
    onCastSpell(selectedLevel, useFreecast, useRitual, usePact);
    if (isReactionSpell && !hasUsedReaction && onReactionSpellCast) {
      onReactionSpellCast();
    }
    handleClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Cast {spell.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-ui text-muted">{spell.school}</span>
              <Badge variant="neutral" size="sm">
                {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
              </Badge>
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
              {spell.castingSource && (
                <span className="type-small text-muted">
                  Source: {spell.castingSource}
                </span>
              )}
            </div>

            {reactionWarning && (
              <div className="border-ember-border border-l-2 pl-3">
                <div className="flex items-start gap-2">
                  <ClockAlert
                    className="text-ember-text mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="type-ui text-ember-text font-semibold">
                      Reaction already used
                    </p>
                    <p className="type-ui text-body mt-1">
                      You&apos;ve already used your reaction this round. You
                      typically can&apos;t cast this spell until your reaction
                      resets on your next turn.
                    </p>
                    {onResetReaction && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => onResetReaction()}
                      >
                        Reset reaction
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {spell.level === 0 ? (
              <p className="type-body text-muted">
                Cantrips don&apos;t use spell slots.
              </p>
            ) : (
              <>
                {(hasFreeCasting ||
                  canRitual ||
                  pactAvailable ||
                  availableLevels.length > 0) && (
                  <RadioGroupField
                    aria-label={`Cast ${spell.name}`}
                    value={selectedChoice}
                    onValueChange={value => {
                      if (value === 'free') handleSelectFreecast();
                      else if (value === 'ritual') handleSelectRitual();
                      else if (value === 'pact') handleSelectPact();
                      else if (value.startsWith('slot-'))
                        handleSelectSlot(Number(value.slice(5)));
                    }}
                    className="grid-cols-1 sm:grid-cols-2"
                  >
                    {hasFreeCasting && (
                      <RadioGroupItem
                        value="free"
                        variant="card"
                        wrapperClassName="pointer-coarse:min-h-11"
                        disabled={!canFreecast}
                        label={
                          isAtWill
                            ? 'Cast at will (no slot)'
                            : 'Cast free (no slot)'
                        }
                        description={
                          isAtWill
                            ? 'Unlimited'
                            : `${freeCastsRemaining}/${spell.freeCastMax} remaining`
                        }
                      />
                    )}
                    {canRitual && (
                      <RadioGroupItem
                        value="ritual"
                        variant="card"
                        wrapperClassName="pointer-coarse:min-h-11"
                        label="Cast as a ritual (no slot)"
                        description="+10 min casting time"
                      />
                    )}
                    {pactAvailable && (
                      <RadioGroupItem
                        value="pact"
                        variant="card"
                        wrapperClassName="pointer-coarse:min-h-11"
                        disabled={!canPact}
                        label={`Pact slot (level ${pactMagic!.level})`}
                        description={`${pactRemaining}/${pactMagic!.slots.max} remaining`}
                      />
                    )}
                    {availableLevels.map(level => {
                      const slot = spellSlots[level as keyof SpellSlots];
                      return (
                        <RadioGroupItem
                          key={level}
                          value={`slot-${level}`}
                          variant="card"
                          wrapperClassName="pointer-coarse:min-h-11"
                          label={`Level ${level}${level === spell.level ? ' (base level)' : ''}`}
                          description={`${slot.max - slot.used}/${slot.max} available`}
                        />
                      );
                    })}
                  </RadioGroupField>
                )}
                {availableLevels.length === 0 &&
                  !canFreecast &&
                  !canRitual &&
                  !canPact && (
                    <div className="space-y-1">
                      <p className="type-body text-body">
                        No available spell slots to cast this spell.
                      </p>
                      <p className="type-ui text-muted">
                        You need at least a level {spell.level} spell slot.
                      </p>
                    </div>
                  )}
                {isInnate && freeCastsRemaining <= 0 && (
                  <p className="type-ui text-muted">
                    Free casts exhausted. Use a spell slot or take a long rest.
                  </p>
                )}
                {spell.higherLevel &&
                  selectedLevel !== null &&
                  !useFreecast &&
                  selectedLevel > spell.level && (
                    <div className="border-divider border-t pt-3">
                      <h3 className="type-subheading text-heading">
                        At Higher Levels
                      </h3>
                      <div
                        className="type-body text-body mt-2"
                        dangerouslySetInnerHTML={{ __html: spell.higherLevel }}
                      />
                    </div>
                  )}
              </>
            )}

            {concentrationWarning && (
              <p className="border-lapis-border type-ui text-body border-l-2 pl-3">
                Casting this ends your concentration on{' '}
                <span className="font-medium">{concentration.spellName}</span>.
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="border-divider flex items-center justify-end gap-3 border-t p-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleClose}
          >
            Cancel
          </Button>
          {canCast && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleCast}
            >
              Cast {spell.name}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
