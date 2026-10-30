'use client';

import React from 'react';
import { Star, Wand2 } from 'lucide-react';
import type { Spell } from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { getScaledSpellDamage } from '@/utils/cantripScaling';

interface SpellDetailsModalProps {
  spell: Spell;
  isOpen: boolean;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onCast?: () => void;
  characterLevel?: number;
}

export default function SpellDetailsModal({
  spell,
  isOpen,
  onClose,
  isFavorite = false,
  onToggleFavorite,
  onCast,
  characterLevel,
}: SpellDetailsModalProps) {
  const displayDamage =
    characterLevel !== undefined
      ? getScaledSpellDamage(spell, characterLevel)
      : spell.damage;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="sr-only">{spell.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-6">
            <header className="space-y-3">
              <h2 className="type-title text-heading">{spell.name}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral" size="sm">
                  {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
                </Badge>
                <Badge variant="neutral" size="sm">
                  {spell.school}
                </Badge>
                {spell.ritual && (
                  <Badge variant="neutral" size="sm">
                    Ritual
                  </Badge>
                )}
                {spell.concentration && (
                  <Badge variant="magic" size="sm">
                    Concentration
                  </Badge>
                )}
                {spell.isPrepared && (
                  <Badge variant="neutral" size="sm">
                    Prepared
                  </Badge>
                )}
                {spell.isAlwaysPrepared && (
                  <Badge variant="neutral" size="sm">
                    Always prepared
                  </Badge>
                )}
              </div>
              {onToggleFavorite && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  selected={isFavorite}
                  aria-pressed={isFavorite}
                  onClick={() => onToggleFavorite()}
                  leftIcon={
                    <Star
                      size={16}
                      fill={isFavorite ? 'currentColor' : 'none'}
                      aria-hidden="true"
                    />
                  }
                >
                  Favorite
                </Button>
              )}
            </header>

            <dl className="border-divider grid grid-cols-1 gap-x-6 gap-y-3 border-y py-4 min-[480px]:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="type-small text-muted">Casting time</dt>
                <dd className="type-body text-heading mt-1">
                  {spell.castingTime}
                </dd>
              </div>
              <div>
                <dt className="type-small text-muted">Range</dt>
                <dd className="type-body text-heading mt-1">{spell.range}</dd>
              </div>
              <div>
                <dt className="type-small text-muted">Duration</dt>
                <dd className="type-body text-heading mt-1">
                  {spell.duration}
                </dd>
              </div>
            </dl>

            <Section heading="Components" level={3}>
              <div className="flex flex-wrap items-center gap-2">
                {spell.components.verbal && (
                  <Badge variant="neutral" size="sm">
                    V
                  </Badge>
                )}
                {spell.components.somatic && (
                  <Badge variant="neutral" size="sm">
                    S
                  </Badge>
                )}
                {spell.components.material && (
                  <Badge variant="neutral" size="sm">
                    M
                  </Badge>
                )}
                {spell.components.materialDescription && (
                  <span className="type-ui text-muted italic">
                    ({spell.components.materialDescription})
                  </span>
                )}
              </div>
            </Section>

            {(spell.actionType || displayDamage) && (
              <Section heading="Combat details" level={3}>
                <div className="flex flex-wrap gap-2">
                  {spell.actionType === 'attack' && (
                    <Badge variant="neutral" size="sm">
                      Spell Attack
                    </Badge>
                  )}
                  {spell.actionType === 'save' && spell.savingThrow && (
                    <Badge variant="neutral" size="sm">
                      {spell.savingThrow} Save
                    </Badge>
                  )}
                  {displayDamage && (
                    <Badge variant="danger" size="sm">
                      {displayDamage} {spell.damageType || 'damage'}
                    </Badge>
                  )}
                </div>
              </Section>
            )}

            <Section heading="Description" level={3}>
              <div
                className="type-body text-body leading-relaxed"
                dangerouslySetInnerHTML={{ __html: spell.description }}
              />
            </Section>

            {spell.higherLevel && (
              <Section heading="At higher levels" level={3}>
                <div
                  className="type-body text-body leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: spell.higherLevel }}
                />
              </Section>
            )}

            {spell.source && (
              <Section heading="Source" level={3}>
                <p className="type-body text-body">{spell.source}</p>
              </Section>
            )}
          </div>
        </DialogBody>
        <DialogFooter className="border-divider border-t p-4">
          {onCast && (
            <Button
              type="button"
              variant="primary"
              size="md"
              leftIcon={<Wand2 size={16} aria-hidden="true" />}
              onClick={() => {
                onCast();
                onClose();
              }}
            >
              Cast spell
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onClose()}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
