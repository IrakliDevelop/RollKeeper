'use client';

import React from 'react';
import { ProcessedSpell } from '@/types/spells';
import { getFormattedHtml } from '@/utils/referenceParser';
import {
  Clock,
  Target,
  Zap,
  Book,
  Sparkles,
  Star,
  CheckCircle,
  Plus,
} from 'lucide-react';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog-new';
import { Badge } from '@/components/ui/layout/badge';
import { Button } from '@/components/ui/forms/button';
import { Card, CardContent } from '@/components/ui/layout/card';

interface SpellDetailModalProps {
  spell: ProcessedSpell;
  isOpen: boolean;
  onClose: () => void;
  isInSpellbook?: boolean;
  isFavorite?: boolean;
  isPrepared?: boolean;
  onAddToSpellbook?: () => void;
  onRemoveFromSpellbook?: () => void;
  onToggleFavorite?: () => void;
  onPrepareSpell?: () => void;
  onUnprepareSpell?: () => void;
}

const SCHOOL_BADGE_VARIANT: Record<
  string,
  | 'primary'
  | 'secondary'
  | 'info'
  | 'danger'
  | 'warning'
  | 'success'
  | 'neutral'
> = {
  A: 'info',
  C: 'warning',
  D: 'info',
  E: 'secondary',
  I: 'secondary',
  N: 'neutral',
  T: 'success',
  V: 'danger',
};

export default function SpellDetailModal({
  spell,
  isOpen,
  onClose,
  isInSpellbook = false,
  isFavorite = false,
  isPrepared = false,
  onAddToSpellbook,
  onRemoveFromSpellbook,
  onToggleFavorite,
  onPrepareSpell,
  onUnprepareSpell,
}: SpellDetailModalProps) {
  const handleToggleSpellbook = () => {
    if (isInSpellbook && onRemoveFromSpellbook) onRemoveFromSpellbook();
    else if (!isInSpellbook && onAddToSpellbook) onAddToSpellbook();
  };

  const schoolBadgeVariant = SCHOOL_BADGE_VARIANT[spell.school] || 'neutral';

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="bg-accent-purple-bg flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-2xl font-bold">
              <span className="text-accent-purple-text">
                {spell.isCantrip ? '∞' : spell.level}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-2xl sm:text-3xl">
                {spell.name}
              </DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={schoolBadgeVariant}>{spell.schoolName}</Badge>
                <div className="text-muted flex items-center gap-1.5 text-sm">
                  <Book className="h-4 w-4" />
                  <span>
                    {spell.classes
                      .slice(0, 3)
                      .map(cls => cls.charAt(0).toUpperCase() + cls.slice(1))
                      .join(', ')}
                    {spell.classes.length > 3 &&
                      ` +${spell.classes.length - 3} more`}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
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
                {isFavorite && (
                  <Badge variant="warning" size="sm">
                    Favorite
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
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-5">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card variant="bordered" padding="sm">
                <CardContent className="flex items-center gap-3 p-0">
                  <Clock className="text-accent-purple-text h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-muted text-xs font-medium">
                      Casting Time
                    </div>
                    <div className="text-heading text-sm font-semibold">
                      {spell.castingTime}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card variant="bordered" padding="sm">
                <CardContent className="flex items-center gap-3 p-0">
                  <Target className="text-accent-purple-text h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-muted text-xs font-medium">Range</div>
                    <div className="text-heading text-sm font-semibold">
                      {spell.range}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card variant="bordered" padding="sm">
                <CardContent className="flex items-center gap-3 p-0">
                  <Zap className="text-accent-purple-text h-5 w-5 shrink-0" />
                  <div>
                    <div className="text-muted text-xs font-medium">
                      Duration
                    </div>
                    <div className="text-heading text-sm font-semibold">
                      {spell.duration}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Components */}
            <Card variant="bordered" padding="md">
              <CardContent className="p-0">
                <h3 className="text-heading mb-3 flex items-center gap-2 font-semibold">
                  <Sparkles className="text-accent-purple-text h-5 w-5" />{' '}
                  Components
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex gap-2">
                    {spell.components.verbal && (
                      <Badge variant="info" size="md">
                        V
                      </Badge>
                    )}
                    {spell.components.somatic && (
                      <Badge variant="success" size="md">
                        S
                      </Badge>
                    )}
                    {spell.components.material && (
                      <Badge variant="secondary" size="md">
                        M
                      </Badge>
                    )}
                  </div>
                  {spell.components.materialComponent && (
                    <p className="text-body text-sm italic">
                      ({spell.components.materialComponent})
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card variant="bordered" padding="md">
              <CardContent className="p-0">
                <h3 className="text-heading mb-3 font-semibold">Description</h3>
                <div
                  className="text-body prose prose-sm max-w-none leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: getFormattedHtml(spell.description),
                  }}
                />
              </CardContent>
            </Card>

            {/* Higher Level */}
            {spell.higherLevelDescription && (
              <Card
                variant="bordered"
                padding="md"
                className="border-accent-purple-border bg-accent-purple-bg/30"
              >
                <CardContent className="p-0">
                  <h3 className="text-accent-purple-text mb-3 font-semibold">
                    At Higher Levels
                  </h3>
                  <div
                    className="text-body text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: getFormattedHtml(spell.higherLevelDescription),
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Source */}
            <div className="text-muted text-sm">
              <span className="font-medium">Source:</span>{' '}
              {SPELL_SOURCE_BOOKS[spell.source] || spell.source}
              {spell.page && ` (page ${spell.page})`}
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {onToggleFavorite && (
                <Button
                  variant={isFavorite ? 'warning' : 'outline'}
                  size="sm"
                  onClick={onToggleFavorite}
                  leftIcon={
                    <Star
                      size={16}
                      className={isFavorite ? 'fill-current' : ''}
                    />
                  }
                >
                  {isFavorite ? 'Favorited' : 'Favorite'}
                </Button>
              )}
              {isInSpellbook && (onPrepareSpell || onUnprepareSpell) && (
                <Button
                  variant={isPrepared ? 'primary' : 'outline'}
                  size="sm"
                  onClick={isPrepared ? onUnprepareSpell : onPrepareSpell}
                  leftIcon={<CheckCircle size={16} />}
                >
                  {isPrepared ? 'Prepared' : 'Prepare'}
                </Button>
              )}
            </div>
            <Button
              variant={isInSpellbook ? 'success' : 'primary'}
              onClick={handleToggleSpellbook}
              leftIcon={
                isInSpellbook ? <CheckCircle size={18} /> : <Plus size={18} />
              }
            >
              {isInSpellbook ? 'In Spellbook' : 'Add to Spellbook'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
