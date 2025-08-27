'use client';

import React, { useCallback, useState } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { getFormattedHtml } from '@/utils/referenceParser';
import {
  Plus,
  Check,
  Clock,
  Target,
  Zap,
  ChevronDown,
  ChevronUp,
  Star,
  ExternalLink,
} from 'lucide-react';
import SpellDetailModal from './SpellDetailModal';
import { SPELL_SOURCE_BOOKS, SPELL_SOURCE_COLORS } from '@/utils/constants';

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

const SCHOOL_COLORS = {
  A: 'bg-blue-500', // Abjuration
  C: 'bg-orange-500', // Conjuration
  D: 'bg-cyan-500', // Divination
  E: 'bg-pink-500', // Enchantment
  I: 'bg-purple-500', // Illusion
  N: 'bg-gray-600', // Necromancy
  T: 'bg-green-500', // Transmutation
  V: 'bg-red-500', // Evocation
};

const LEVEL_COLORS = {
  0: 'text-gray-400 border-gray-400',
  1: 'text-blue-400 border-blue-400',
  2: 'text-green-400 border-green-400',
  3: 'text-yellow-400 border-yellow-400',
  4: 'text-orange-400 border-orange-400',
  5: 'text-red-400 border-red-400',
  6: 'text-purple-400 border-purple-400',
  7: 'text-pink-400 border-pink-400',
  8: 'text-cyan-400 border-cyan-400',
  9: 'text-white border-white',
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const schoolColor = SCHOOL_COLORS[spell.school] || 'bg-gray-500';
  const levelColor =
    LEVEL_COLORS[spell.level as keyof typeof LEVEL_COLORS] ||
    'text-gray-400 border-gray-400';

  const formatDescription = (text: string, maxLength: number = 150) => {
    const formattedHtml = getFormattedHtml(text);
    if (showFullDescription || text.length <= maxLength) {
      return formattedHtml;
    }
    // For truncated text, we need to work with plain text first, then format
    const truncated = text.substring(0, maxLength) + '...';
    return getFormattedHtml(truncated);
  };

  // Function that gives the spell source a unique badge color based on the source.
  const getSourceColor = useCallback((source: string) => {
    return SPELL_SOURCE_COLORS[source] || 'bg-slate-500';
  }, []);

  const handleToggleSpellbook = () => {
    if (isInSpellbook && onRemoveFromSpellbook) {
      onRemoveFromSpellbook();
    } else if (!isInSpellbook && onAddToSpellbook) {
      onAddToSpellbook();
    }
  };

  if (displayMode === 'list') {
    return (
      <>
        <div className="rounded-lg border border-slate-600/50 bg-slate-800/30 p-4 transition-all hover:bg-slate-700/30">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-3">
                {/* Level Badge */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${levelColor} text-sm font-bold`}
                >
                  {spell.isCantrip ? 'C' : spell.level}
                </div>

                {/* Spell Name */}
                <h3 className="text-lg font-semibold text-white">
                  {spell.name}
                </h3>

                {/* Favorite Star */}
                {isFavorite && (
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                )}

                {/* School Badge */}
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium text-white ${schoolColor}`}
                >
                  {spell.schoolName}
                </span>

                {/* Status Tags */}
                <div className="flex gap-1">
                  {isInSpellbook && (
                    <span className="rounded border border-green-500/30 bg-green-600/20 px-2 py-1 text-xs text-green-400">
                      Known
                    </span>
                  )}
                  {isPrepared && (
                    <span className="rounded border border-blue-500/30 bg-blue-600/20 px-2 py-1 text-xs text-blue-400">
                      Prepared
                    </span>
                  )}
                  {spell.isRitual && (
                    <span className="rounded border border-amber-500/30 bg-amber-600/20 px-2 py-1 text-xs text-amber-400">
                      Ritual
                    </span>
                  )}
                  {spell.concentration && (
                    <span className="rounded border border-red-500/30 bg-red-600/20 px-2 py-1 text-xs text-red-400">
                      Concentration
                    </span>
                  )}
                </div>
              </div>

              {/* Spell Details */}
              <div className="mb-3 grid grid-cols-3 gap-4 text-sm text-slate-300">
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

              {/* Components */}
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm text-slate-400">Components:</span>
                <div className="flex gap-1">
                  {spell.components.verbal && (
                    <span className="flex h-6 w-6 items-center justify-center rounded border border-blue-500/30 bg-blue-600/20 text-xs text-blue-400">
                      V
                    </span>
                  )}
                  {spell.components.somatic && (
                    <span className="flex h-6 w-6 items-center justify-center rounded border border-green-500/30 bg-green-600/20 text-xs text-green-400">
                      S
                    </span>
                  )}
                  {spell.components.material && (
                    <span className="flex h-6 w-6 items-center justify-center rounded border border-purple-500/30 bg-purple-600/20 text-xs text-purple-400">
                      M
                    </span>
                  )}
                </div>
                {spell.components.materialComponent && (
                  <span className="text-xs text-slate-400">
                    ({spell.components.materialComponent})
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="text-sm leading-relaxed text-slate-300">
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatDescription(spell.description),
                  }}
                />
                {spell.description.length > 150 && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() =>
                        setShowFullDescription(!showFullDescription)
                      }
                      className="text-xs text-amber-400 underline hover:text-amber-300"
                    >
                      {showFullDescription ? 'Show less' : 'Show more'}
                    </button>
                    <span className="text-slate-500">•</span>
                    <button
                      onClick={() => setIsDetailModalOpen(true)}
                      className="flex items-center gap-1 text-xs text-amber-400 underline hover:text-amber-300"
                    >
                      <ExternalLink size={12} />
                      View Details
                    </button>
                  </div>
                )}
                {spell.description.length <= 150 && (
                  <button
                    onClick={() => setIsDetailModalOpen(true)}
                    className="mt-2 flex items-center gap-1 text-xs text-amber-400 underline hover:text-amber-300"
                  >
                    <ExternalLink size={12} />
                    View Details
                  </button>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="ml-4 flex flex-col gap-2">
              <div className="flex gap-2">
                {/* Favorite Button */}
                {onToggleFavorite && (
                  <button
                    onClick={onToggleFavorite}
                    className={`rounded-lg p-2 transition-all ${
                      isFavorite
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                    }`}
                    title={
                      isFavorite ? 'Remove from favorites' : 'Add to favorites'
                    }
                  >
                    <Star
                      size={16}
                      className={isFavorite ? 'fill-current' : ''}
                    />
                  </button>
                )}

                {/* Spellbook Toggle */}
                <button
                  onClick={handleToggleSpellbook}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                    isInSpellbook
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                  }`}
                >
                  {isInSpellbook ? <Check size={16} /> : <Plus size={16} />}
                  {isInSpellbook ? 'Known' : 'Add'}
                </button>
              </div>

              {/* Prepare Button - only show if spell is in spellbook */}
              {isInSpellbook && (onPrepareSpell || onUnprepareSpell) && (
                <button
                  onClick={isPrepared ? onUnprepareSpell : onPrepareSpell}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                    isPrepared
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                  }`}
                >
                  {isPrepared ? 'Prepared' : 'Prepare'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Spell Detail Modal */}
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

  // Grid view (default)
  return (
    <>
      <div className="rounded-lg border border-slate-600/50 bg-slate-800/50 p-4 backdrop-blur-sm transition-all hover:bg-slate-700/50">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {/* Level Badge */}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${levelColor} text-sm font-bold`}
            >
              {spell.isCantrip ? 'C' : spell.level}
            </div>

            {/* Favorite Star */}
            {isFavorite && (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            )}
          </div>

          {/* School Badge */}
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium text-white ${schoolColor}`}
          >
            {spell.schoolName}
          </span>
        </div>

        {/* Spell Name */}
        <h3 className="mb-2 text-lg leading-tight font-bold text-white">
          {spell.name}
        </h3>
        <div className="mb-2 flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs text-white ${getSourceColor(spell.source)} drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]`}
          >
            {SPELL_SOURCE_BOOKS[spell.source] || spell.source}
          </span>
        </div>

        {/* Status Tags */}
        <div className="mb-3 flex flex-wrap gap-1">
          {isInSpellbook && (
            <span className="rounded border border-green-500/30 bg-green-600/20 px-2 py-1 text-xs text-green-400">
              Known
            </span>
          )}
          {isPrepared && (
            <span className="rounded border border-blue-500/30 bg-blue-600/20 px-2 py-1 text-xs text-blue-400">
              Prepared
            </span>
          )}
          {spell.isRitual && (
            <span className="rounded border border-amber-500/30 bg-amber-600/20 px-2 py-1 text-xs text-amber-400">
              Ritual
            </span>
          )}
          {spell.concentration && (
            <span className="rounded border border-red-500/30 bg-red-600/20 px-2 py-1 text-xs text-red-400">
              Concentration
            </span>
          )}
        </div>

        {/* Spell Details */}
        <div className="mb-4 space-y-2 text-sm text-slate-300">
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

        {/* Components */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex gap-1">
            {spell.components.verbal && (
              <span className="flex h-6 w-6 items-center justify-center rounded border border-blue-500/30 bg-blue-600/20 text-xs text-blue-400">
                V
              </span>
            )}
            {spell.components.somatic && (
              <span className="flex h-6 w-6 items-center justify-center rounded border border-green-500/30 bg-green-600/20 text-xs text-green-400">
                S
              </span>
            )}
            {spell.components.material && (
              <span className="flex h-6 w-6 items-center justify-center rounded border border-purple-500/30 bg-purple-600/20 text-xs text-purple-400">
                M
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <div
            className="line-clamp-3 text-sm leading-relaxed text-slate-300"
            dangerouslySetInnerHTML={{
              __html: formatDescription(spell.description),
            }}
          />
          <div className="mt-2 flex items-center gap-2">
            {spell.description.length > 150 && (
              <>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                >
                  {isExpanded ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
                <span className="text-slate-500">•</span>
              </>
            )}
            <button
              onClick={() => setIsDetailModalOpen(true)}
              className="flex items-center gap-1 text-xs text-amber-400 underline hover:text-amber-300"
            >
              <ExternalLink size={12} />
              View Details
            </button>
          </div>
        </div>

        {/* Expanded Description */}
        {isExpanded && (
          <div className="mb-4 rounded border border-slate-600/30 bg-slate-700/30 p-3">
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300"
              dangerouslySetInnerHTML={{
                __html: getFormattedHtml(spell.description),
              }}
            />
            {spell.higherLevelDescription && (
              <div className="mt-3 border-t border-slate-600/30 pt-3">
                <h4 className="mb-1 text-sm font-semibold text-amber-400">
                  At Higher Levels:
                </h4>
                <div
                  className="text-sm text-slate-300"
                  dangerouslySetInnerHTML={{
                    __html: getFormattedHtml(spell.higherLevelDescription),
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <div className="flex gap-2">
            {/* Favorite Button */}
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className={`rounded-lg p-2 transition-all ${
                  isFavorite
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                }`}
                title={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
              >
                <Star size={16} className={isFavorite ? 'fill-current' : ''} />
              </button>
            )}

            {/* Spellbook Toggle */}
            <button
              onClick={handleToggleSpellbook}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 transition-all ${
                isInSpellbook
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
              }`}
            >
              {isInSpellbook ? <Check size={16} /> : <Plus size={16} />}
              {isInSpellbook ? 'Known' : 'Add'}
            </button>
          </div>

          {/* Prepare Button - only show if spell is in spellbook */}
          {isInSpellbook && (onPrepareSpell || onUnprepareSpell) && (
            <button
              onClick={isPrepared ? onUnprepareSpell : onPrepareSpell}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-all ${
                isPrepared
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
              }`}
            >
              {isPrepared ? 'Prepared' : 'Prepare'}
            </button>
          )}
        </div>
      </div>

      {/* Spell Detail Modal */}
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
