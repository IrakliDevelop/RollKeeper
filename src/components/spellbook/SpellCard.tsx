'use client';

import React, { useCallback, useState } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { Plus, Check, Clock, Target, Zap, Star } from 'lucide-react';
import SpellDetailModal from './SpellDetailModal';
import { SPELL_SOURCE_BOOKS, SPELL_SOURCE_COLORS } from '@/utils/constants';
import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Card } from '@/components/ui/layout/card';

interface SpellCardProps {
  spell: ProcessedSpell;
  displayMode: 'grid' | 'list';
  isInSpellbook?: boolean;
  isFavorite?: boolean;
  isPrepared?: boolean;
  onAddToSpellbook?: () => void;
  onRemoveFromSpellbook?: () => void;
  onToggleFavorite?: () => void;
  onPrepareSpell?: () => void;
  onUnprepareSpell?: () => void;
}

const SCHOOL_COLORS: Record<string, string> = {
  A: 'bg-accent-blue-bg text-accent-blue-text',
  C: 'bg-accent-orange-bg text-accent-orange-text',
  D: 'bg-accent-blue-bg text-accent-blue-text',
  E: 'bg-accent-purple-bg text-accent-purple-text',
  I: 'bg-accent-violet-bg text-accent-violet-text',
  N: 'bg-surface-secondary text-muted',
  T: 'bg-accent-emerald-bg text-accent-emerald-text',
  V: 'bg-accent-red-bg text-accent-red-text',
};

const LEVEL_COLORS: Record<number, string> = {
  0: 'text-muted border-divider',
  1: 'text-accent-blue-text border-accent-blue-border',
  2: 'text-accent-emerald-text border-accent-emerald-border',
  3: 'text-accent-amber-text border-accent-amber-border',
  4: 'text-accent-orange-text border-accent-orange-border',
  5: 'text-accent-red-text border-accent-red-border',
  6: 'text-accent-purple-text border-accent-purple-border',
  7: 'text-accent-violet-text border-accent-violet-border',
  8: 'text-accent-blue-text border-accent-blue-border',
  9: 'text-heading border-divider-strong',
};

export default function SpellCard({
  spell,
  displayMode,
  isInSpellbook = false,
  isFavorite = false,
  isPrepared = false,
  onAddToSpellbook,
  onRemoveFromSpellbook,
  onToggleFavorite,
  onPrepareSpell,
  onUnprepareSpell,
}: SpellCardProps) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const schoolColor =
    SCHOOL_COLORS[spell.school] || 'bg-surface-secondary text-muted';
  const levelColor = LEVEL_COLORS[spell.level] || 'text-muted border-divider';

  const getSourceColor = useCallback((source: string) => {
    return SPELL_SOURCE_COLORS[source] || 'bg-surface-secondary';
  }, []);

  const handleToggleSpellbook = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInSpellbook && onRemoveFromSpellbook) onRemoveFromSpellbook();
    else if (!isInSpellbook && onAddToSpellbook) onAddToSpellbook();
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.();
  };

  const handlePrepare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPrepared) onUnprepareSpell?.();
    else onPrepareSpell?.();
  };

  if (displayMode === 'list') {
    return (
      <>
        <Card
          variant="bordered"
          padding="md"
          interactive
          onClick={() => setIsDetailModalOpen(true)}
          className="cursor-pointer transition-all hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${levelColor} text-sm font-bold`}
                >
                  {spell.isCantrip ? 'C' : spell.level}
                </div>
                <h3 className="text-heading text-lg font-semibold">
                  {spell.name}
                </h3>
                {isFavorite && (
                  <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
                )}
                <Badge size="sm" className={schoolColor}>
                  {spell.schoolName}
                </Badge>
                {isInSpellbook && (
                  <Badge variant="success" size="sm">
                    Known
                  </Badge>
                )}
                {isPrepared && (
                  <Badge variant="info" size="sm">
                    Prepared
                  </Badge>
                )}
                {spell.isRitual && (
                  <Badge variant="warning" size="sm">
                    Ritual
                  </Badge>
                )}
                {spell.concentration && (
                  <Badge variant="danger" size="sm">
                    Concentration
                  </Badge>
                )}
              </div>

              <div className="text-muted mb-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>{spell.castingTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target size={14} />
                  <span>{spell.range}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={14} />
                  <span>{spell.duration}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex gap-1">
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
                    <Badge variant="secondary" size="sm">
                      M
                    </Badge>
                  )}
                </div>
                {spell.components.materialComponent && (
                  <span className="text-faint text-xs">
                    ({spell.components.materialComponent})
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <div className="flex gap-2">
                {onToggleFavorite && (
                  <Button
                    variant={isFavorite ? 'warning' : 'outline'}
                    size="sm"
                    onClick={handleToggleFavorite}
                    aria-label={
                      isFavorite ? 'Remove from favorites' : 'Add to favorites'
                    }
                  >
                    <Star
                      size={16}
                      className={isFavorite ? 'fill-current' : ''}
                    />
                  </Button>
                )}
                <Button
                  variant={isInSpellbook ? 'success' : 'outline'}
                  size="sm"
                  onClick={handleToggleSpellbook}
                  leftIcon={
                    isInSpellbook ? <Check size={16} /> : <Plus size={16} />
                  }
                >
                  {isInSpellbook ? 'Known' : 'Add'}
                </Button>
              </div>
              {isInSpellbook && (onPrepareSpell || onUnprepareSpell) && (
                <Button
                  variant={isPrepared ? 'primary' : 'outline'}
                  size="sm"
                  onClick={handlePrepare}
                >
                  {isPrepared ? 'Prepared' : 'Prepare'}
                </Button>
              )}
            </div>
          </div>
        </Card>

        <SpellDetailModal
          spell={spell}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          isInSpellbook={isInSpellbook}
          isFavorite={isFavorite}
          isPrepared={isPrepared}
          onAddToSpellbook={onAddToSpellbook}
          onRemoveFromSpellbook={onRemoveFromSpellbook}
          onToggleFavorite={onToggleFavorite}
          onPrepareSpell={onPrepareSpell}
          onUnprepareSpell={onUnprepareSpell}
        />
      </>
    );
  }

  return (
    <>
      <Card
        variant="bordered"
        padding="md"
        interactive
        onClick={() => setIsDetailModalOpen(true)}
        className="flex h-full cursor-pointer flex-col transition-all hover:shadow-md"
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${levelColor} text-sm font-bold`}
            >
              {spell.isCantrip ? 'C' : spell.level}
            </div>
            {isFavorite && (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            )}
          </div>
          <Badge size="sm" className={schoolColor}>
            {spell.schoolName}
          </Badge>
        </div>

        <h3 className="text-heading mb-2 text-lg leading-tight font-bold">
          {spell.name}
        </h3>
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${getSourceColor(spell.source)}`}
          >
            {SPELL_SOURCE_BOOKS[spell.source] || spell.source}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          {isInSpellbook && (
            <Badge variant="success" size="sm">
              Known
            </Badge>
          )}
          {isPrepared && (
            <Badge variant="info" size="sm">
              Prepared
            </Badge>
          )}
          {spell.isRitual && (
            <Badge variant="warning" size="sm">
              Ritual
            </Badge>
          )}
          {spell.concentration && (
            <Badge variant="danger" size="sm">
              Concentration
            </Badge>
          )}
        </div>

        <div className="text-muted mb-4 space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Clock size={14} />
            <span>{spell.castingTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target size={14} />
            <span>{spell.range}</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={14} />
            <span>{spell.duration}</span>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-1">
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
            <Badge variant="secondary" size="sm">
              M
            </Badge>
          )}
        </div>

        <div className="text-body mb-4 line-clamp-3 flex-1 text-sm leading-relaxed">
          {spell.description.substring(0, 150)}
          {spell.description.length > 150 && '...'}
        </div>

        <div className="mt-auto space-y-2">
          <div className="flex gap-2">
            {onToggleFavorite && (
              <Button
                variant={isFavorite ? 'warning' : 'outline'}
                size="sm"
                onClick={handleToggleFavorite}
                aria-label={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
              >
                <Star size={16} className={isFavorite ? 'fill-current' : ''} />
              </Button>
            )}
            <Button
              variant={isInSpellbook ? 'success' : 'outline'}
              size="sm"
              onClick={handleToggleSpellbook}
              leftIcon={
                isInSpellbook ? <Check size={16} /> : <Plus size={16} />
              }
              fullWidth
            >
              {isInSpellbook ? 'Known' : 'Add'}
            </Button>
          </div>
          {isInSpellbook && (onPrepareSpell || onUnprepareSpell) && (
            <Button
              variant={isPrepared ? 'primary' : 'outline'}
              size="sm"
              onClick={handlePrepare}
              fullWidth
            >
              {isPrepared ? 'Prepared' : 'Prepare'}
            </Button>
          )}
        </div>
      </Card>

      <SpellDetailModal
        spell={spell}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        isInSpellbook={isInSpellbook}
        isFavorite={isFavorite}
        isPrepared={isPrepared}
        onAddToSpellbook={onAddToSpellbook}
        onRemoveFromSpellbook={onRemoveFromSpellbook}
        onToggleFavorite={onToggleFavorite}
        onPrepareSpell={onPrepareSpell}
        onUnprepareSpell={onUnprepareSpell}
      />
    </>
  );
}
