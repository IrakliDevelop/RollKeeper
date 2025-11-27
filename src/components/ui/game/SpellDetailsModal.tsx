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
      <div className="-m-6 mb-6 border-b-2 border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Spell Name */}
            <h1 className="mb-3 text-3xl font-bold text-gray-900">
              {spell.name}
            </h1>

            {/* Badges */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                variant={isCantrip ? 'warning' : 'primary'}
                size="sm"
                className={
                  isCantrip
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-purple-100 text-purple-800'
                }
              >
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
                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
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
          <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">
                Casting Time
              </span>
            </div>
            <p className="font-semibold text-gray-900">{spell.castingTime}</p>
          </div>

          <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Range</span>
            </div>
            <p className="font-semibold text-gray-900">{spell.range}</p>
          </div>

          <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">
                Duration
              </span>
            </div>
            <p className="font-semibold text-gray-900">{spell.duration}</p>
          </div>
        </div>

        {/* Components */}
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
            <Sparkles className="h-5 w-5 text-purple-600" />
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
              <p className="text-sm text-gray-600 italic">
                ({spell.components.materialDescription})
              </p>
            )}
          </div>
        </div>

        {/* Combat Info */}
        {(spell.actionType || spell.damage) && (
          <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
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
        <div className="rounded-lg border-2 border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-bold text-gray-900">Description</h3>
          <div className="prose prose-gray max-w-none">
            <div
              className="leading-relaxed text-gray-700"
              dangerouslySetInnerHTML={{ __html: spell.description }}
            />
          </div>
        </div>

        {/* Higher Level */}
        {spell.higherLevel && (
          <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-3 text-lg font-bold text-amber-900">
              At Higher Levels
            </h3>
            <div
              className="leading-relaxed text-amber-800"
              dangerouslySetInnerHTML={{ __html: spell.higherLevel }}
            />
          </div>
        )}

        {/* Source */}
        {spell.source && (
          <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-bold text-gray-900">Source</h3>
            <p className="text-gray-700">{spell.source}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="-m-6 mt-6 border-t-2 border-gray-200 bg-gray-50 p-4">
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
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
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
