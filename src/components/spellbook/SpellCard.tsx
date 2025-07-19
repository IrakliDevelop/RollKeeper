'use client';

import React, { useState } from 'react';
import { ProcessedSpell } from '@/types/spells';
import { 
  Plus, 
  Check, 
  Clock, 
  Target, 
  Zap, 
  ChevronDown, 
  ChevronUp,
  Eye,
  Star,
  BookOpen,
  Circle,
  ExternalLink
} from 'lucide-react';
import SpellDetailModal from './SpellDetailModal';

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
  onUnprepareSpell
}: SpellCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const schoolColor = SCHOOL_COLORS[spell.school] || 'bg-gray-500';
  const levelColor = LEVEL_COLORS[spell.level as keyof typeof LEVEL_COLORS] || 'text-gray-400 border-gray-400';

  const formatDescription = (text: string, maxLength: number = 150) => {
    if (showFullDescription || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  };

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
        <div className="bg-slate-800/30 border border-slate-600/50 rounded-lg p-4 hover:bg-slate-700/30 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                {/* Level Badge */}
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${levelColor} font-bold text-sm`}>
                  {spell.isCantrip ? 'C' : spell.level}
                </div>
                
                {/* Spell Name */}
                <h3 className="text-lg font-semibold text-white">{spell.name}</h3>
                
                {/* Favorite Star */}
                {isFavorite && (
                  <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                )}
                
                {/* School Badge */}
                <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${schoolColor}`}>
                  {spell.schoolName}
                </span>
                
                {/* Status Tags */}
                <div className="flex gap-1">
                  {isInSpellbook && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded border border-green-500/30">
                      Known
                    </span>
                  )}
                  {isPrepared && (
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-500/30">
                      Prepared
                    </span>
                  )}
                  {spell.isRitual && (
                    <span className="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs rounded border border-amber-500/30">
                      Ritual
                    </span>
                  )}
                  {spell.concentration && (
                    <span className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded border border-red-500/30">
                      Concentration
                    </span>
                  )}
                </div>
              </div>

              {/* Spell Details */}
              <div className="grid grid-cols-3 gap-4 text-sm text-slate-300 mb-3">
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
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-slate-400">Components:</span>
                <div className="flex gap-1">
                  {spell.components.verbal && (
                    <span className="w-6 h-6 bg-blue-600/20 text-blue-400 rounded text-xs flex items-center justify-center border border-blue-500/30">
                      V
                    </span>
                  )}
                  {spell.components.somatic && (
                    <span className="w-6 h-6 bg-green-600/20 text-green-400 rounded text-xs flex items-center justify-center border border-green-500/30">
                      S
                    </span>
                  )}
                  {spell.components.material && (
                    <span className="w-6 h-6 bg-purple-600/20 text-purple-400 rounded text-xs flex items-center justify-center border border-purple-500/30">
                      M
                    </span>
                  )}
                </div>
                {spell.components.materialComponent && (
                  <span className="text-xs text-slate-400">({spell.components.materialComponent})</span>
                )}
              </div>

              {/* Description */}
              <p className="text-sm text-slate-300 leading-relaxed">
                {formatDescription(spell.description)}
                {spell.description.length > 150 && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => setShowFullDescription(!showFullDescription)}
                      className="text-amber-400 hover:text-amber-300 text-xs underline"
                    >
                      {showFullDescription ? 'Show less' : 'Show more'}
                    </button>
                    <span className="text-slate-500">•</span>
                    <button
                      onClick={() => setIsDetailModalOpen(true)}
                      className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs underline"
                    >
                      <ExternalLink size={12} />
                      View Details
                    </button>
                  </div>
                )}
                {spell.description.length <= 150 && (
                  <button
                    onClick={() => setIsDetailModalOpen(true)}
                    className="flex items-center gap-1 mt-2 text-amber-400 hover:text-amber-300 text-xs underline"
                  >
                    <ExternalLink size={12} />
                    View Details
                  </button>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="ml-4 flex flex-col gap-2">
              <div className="flex gap-2">
                {/* Favorite Button */}
                {onToggleFavorite && (
                  <button
                    onClick={onToggleFavorite}
                    className={`p-2 rounded-lg transition-all ${
                      isFavorite
                        ? 'bg-yellow-600 text-white'
                        : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                    }`}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star size={16} className={isFavorite ? 'fill-current' : ''} />
                  </button>
                )}
                
                {/* Spellbook Toggle */}
                <button
                  onClick={handleToggleSpellbook}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    isInSpellbook
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                    isPrepared
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
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
      <div className="bg-slate-800/50 border border-slate-600/50 rounded-lg p-4 hover:bg-slate-700/50 transition-all backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Level Badge */}
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${levelColor} font-bold text-sm`}>
              {spell.isCantrip ? 'C' : spell.level}
            </div>
            
            {/* Favorite Star */}
            {isFavorite && (
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
            )}
          </div>
          
          {/* School Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${schoolColor}`}>
            {spell.schoolName}
          </span>
        </div>

        {/* Spell Name */}
        <h3 className="text-lg font-bold text-white mb-2 leading-tight">{spell.name}</h3>
        
        {/* Status Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {isInSpellbook && (
            <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded border border-green-500/30">
              Known
            </span>
          )}
          {isPrepared && (
            <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded border border-blue-500/30">
              Prepared
            </span>
          )}
          {spell.isRitual && (
            <span className="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs rounded border border-amber-500/30">
              Ritual
            </span>
          )}
          {spell.concentration && (
            <span className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded border border-red-500/30">
              Concentration
            </span>
          )}
        </div>

        {/* Spell Details */}
        <div className="space-y-2 text-sm text-slate-300 mb-4">
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
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1">
            {spell.components.verbal && (
              <span className="w-6 h-6 bg-blue-600/20 text-blue-400 rounded text-xs flex items-center justify-center border border-blue-500/30">
                V
              </span>
            )}
            {spell.components.somatic && (
              <span className="w-6 h-6 bg-green-600/20 text-green-400 rounded text-xs flex items-center justify-center border border-green-500/30">
                S
              </span>
            )}
            {spell.components.material && (
              <span className="w-6 h-6 bg-purple-600/20 text-purple-400 rounded text-xs flex items-center justify-center border border-purple-500/30">
                M
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
            {formatDescription(spell.description)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {spell.description.length > 150 && (
              <>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs"
                >
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
                <span className="text-slate-500">•</span>
              </>
            )}
            <button
              onClick={() => setIsDetailModalOpen(true)}
              className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs underline"
            >
              <ExternalLink size={12} />
              View Details
            </button>
          </div>
        </div>

        {/* Expanded Description */}
        {isExpanded && (
          <div className="mb-4 p-3 bg-slate-700/30 rounded border border-slate-600/30">
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {spell.description}
            </p>
            {spell.higherLevelDescription && (
              <div className="mt-3 pt-3 border-t border-slate-600/30">
                <h4 className="text-sm font-semibold text-amber-400 mb-1">At Higher Levels:</h4>
                <p className="text-sm text-slate-300">{spell.higherLevelDescription}</p>
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
                className={`p-2 rounded-lg transition-all ${
                  isFavorite
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
                }`}
                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star size={16} className={isFavorite ? 'fill-current' : ''} />
              </button>
            )}
            
            {/* Spellbook Toggle */}
            <button
              onClick={handleToggleSpellbook}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all ${
                isInSpellbook
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
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
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                isPrepared
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
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