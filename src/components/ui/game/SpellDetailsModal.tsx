'use client';

import React from 'react';
import { Spell } from '@/types/character';
import { Clock, Target, Zap, Sparkles, Star, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';
import { Modal } from '@/components/ui/feedback/Modal';

interface SpellDetailsModalProps {
  spell: Spell;
  isOpen: boolean;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onCast?: () => void;
}

export default function SpellDetailsModal({
  spell,
  isOpen,
  onClose,
  isFavorite = false,
  onToggleFavorite,
  onCast,
}: SpellDetailsModalProps) {
  const isCantrip = spell.level === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      closeOnBackdropClick={true}
    >
      {/* Header */}
      <div className="border-accent-purple-border from-accent-purple-bg to-accent-blue-bg -m-6 mb-6 border-b-2 bg-linear-to-r p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Spell Name */}
            <h1 className="text-heading mb-3 text-3xl font-bold">
              {spell.name}
            </h1>

            {/* Badges */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant={isCantrip ? 'warning' : 'primary'} size="sm">
                {isCantrip ? 'Cantrip' : `Level ${spell.level}`}
              </Badge>
              <Badge variant="secondary" size="sm">
                {spell.school}
              </Badge>
              {spell.ritual && (
                <Badge variant="warning" size="sm">
                  🕯️ Ritual
                </Badge>
              )}
              {spell.concentration && (
                <Badge variant="warning" size="sm">
                  🧠 Concentration
                </Badge>
              )}
              {spell.isPrepared && (
                <Badge variant="success" size="sm">
                  ✓ Prepared
                </Badge>
              )}
              {spell.isAlwaysPrepared && (
                <Badge variant="success" size="sm">
                  ⭐ Always Prepared
                </Badge>
              )}
            </div>

            {/* Favorite Button */}
            {onToggleFavorite && (
              <Button
                onClick={onToggleFavorite}
                variant={isFavorite ? 'warning' : 'ghost'}
                size="sm"
                leftIcon={
                  <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                }
                className={
                  isFavorite
                    ? 'bg-accent-yellow-bg text-accent-yellow-text hover:bg-accent-yellow-bg-strong'
                    : ''
                }
              >
                {isFavorite ? 'Favorited' : 'Add to Favorites'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="border-divider bg-surface-raised rounded-lg border-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="text-accent-purple-text-muted h-5 w-5" />
              <span className="text-muted text-sm font-medium">
                Casting Time
              </span>
            </div>
            <p className="text-heading font-semibold">{spell.castingTime}</p>
          </div>

          <div className="border-divider bg-surface-raised rounded-lg border-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Target className="text-accent-purple-text-muted h-5 w-5" />
              <span className="text-muted text-sm font-medium">Range</span>
            </div>
            <p className="text-heading font-semibold">{spell.range}</p>
          </div>

          <div className="border-divider bg-surface-raised rounded-lg border-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Zap className="text-accent-purple-text-muted h-5 w-5" />
              <span className="text-muted text-sm font-medium">Duration</span>
            </div>
            <p className="text-heading font-semibold">{spell.duration}</p>
          </div>
        </div>

        {/* Components */}
        <div className="border-divider bg-surface-raised rounded-lg border-2 p-4">
          <h3 className="text-heading mb-3 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="text-accent-purple-text-muted h-5 w-5" />
            Components
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              {spell.components.verbal && (
                <Badge variant="info" size="sm">
                  V
                </Badge>
              )}
              {spell.components.somatic && (
                <Badge variant="success" size="sm">
                  S
                </Badge>
              )}
              {spell.components.material && (
                <Badge variant="primary" size="sm">
                  M
                </Badge>
              )}
            </div>
            {spell.components.materialDescription && (
              <p className="text-muted text-sm italic">
                ({spell.components.materialDescription})
              </p>
            )}
          </div>
        </div>

        {/* Combat Info */}
        {(spell.actionType || spell.damage) && (
          <div className="border-divider bg-surface-raised rounded-lg border-2 p-4">
            <h3 className="text-heading mb-3 text-lg font-bold">
              Combat Details
            </h3>
            <div className="flex flex-wrap gap-2">
              {spell.actionType === 'attack' && (
                <Badge variant="secondary" size="sm">
                  Spell Attack
                </Badge>
              )}
              {spell.actionType === 'save' && spell.savingThrow && (
                <Badge variant="info" size="sm">
                  {spell.savingThrow} Save
                </Badge>
              )}
              {spell.damage && (
                <Badge variant="danger" size="sm">
                  {spell.damage} {spell.damageType || 'damage'}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="border-divider bg-surface-raised rounded-lg border-2 p-4">
          <h3 className="text-heading mb-3 text-lg font-bold">Description</h3>
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <div
              className="text-body leading-relaxed"
              dangerouslySetInnerHTML={{ __html: spell.description }}
            />
          </div>
        </div>

        {/* Higher Level */}
        {spell.higherLevel && (
          <div className="border-accent-amber-border bg-accent-amber-bg rounded-lg border-2 p-4">
            <h3 className="text-accent-amber-text mb-3 text-lg font-bold">
              At Higher Levels
            </h3>
            <div
              className="text-accent-amber-text leading-relaxed"
              dangerouslySetInnerHTML={{ __html: spell.higherLevel }}
            />
          </div>
        )}

        {/* Source */}
        {spell.source && (
          <div className="border-divider bg-surface-secondary rounded-lg border-2 p-4">
            <h3 className="text-heading mb-2 text-sm font-bold">Source</h3>
            <p className="text-body">{spell.source}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-divider bg-surface-secondary -m-6 mt-6 border-t-2 p-4">
        <div className="flex items-center justify-between">
          {onCast ? (
            <Button
              onClick={() => {
                onCast();
                onClose();
              }}
              variant="primary"
              size="md"
              leftIcon={<Wand2 size={16} />}
              className="bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
            >
              Cast Spell
            </Button>
          ) : (
            <div />
          )}
          <Button onClick={onClose} variant="outline" size="md">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
