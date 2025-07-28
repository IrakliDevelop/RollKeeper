import React from 'react';
import { ProcessedSpell } from '@/types/spells';
import { getFormattedHtml } from '@/utils/referenceParser';
import { 
  X, 
  Clock, 
  Target, 
  Zap, 
  Book, 
  Sparkles,
  Star,
  CheckCircle,
  Plus
} from 'lucide-react';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';

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

const SCHOOL_COLORS = {
  A: 'from-blue-500 to-blue-600', // Abjuration
  C: 'from-orange-500 to-orange-600', // Conjuration
  D: 'from-cyan-500 to-cyan-600', // Divination
  E: 'from-pink-500 to-pink-600', // Enchantment
  I: 'from-purple-500 to-purple-600', // Illusion
  N: 'from-gray-500 to-gray-600', // Necromancy
  T: 'from-green-500 to-green-600', // Transmutation
  V: 'from-red-500 to-red-600', // Evocation
};

const LEVEL_COLORS = {
  0: 'from-gray-400 to-gray-500',
  1: 'from-blue-400 to-blue-500',
  2: 'from-green-400 to-green-500',
  3: 'from-yellow-400 to-yellow-500',
  4: 'from-orange-400 to-orange-500',
  5: 'from-red-400 to-red-500',
  6: 'from-purple-400 to-purple-500',
  7: 'from-pink-400 to-pink-500',
  8: 'from-cyan-400 to-cyan-500',
  9: 'from-white to-gray-200',
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
  onUnprepareSpell
}: SpellDetailModalProps) {
  if (!isOpen) return null;

  const schoolColor = SCHOOL_COLORS[spell.school as keyof typeof SCHOOL_COLORS] || 'from-gray-500 to-gray-600';
  const levelGradient = LEVEL_COLORS[spell.level as keyof typeof LEVEL_COLORS] || 'from-gray-400 to-gray-500';

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleToggleSpellbook = () => {
    if (isInSpellbook && onRemoveFromSpellbook) {
      onRemoveFromSpellbook();
    } else if (!isInSpellbook && onAddToSpellbook) {
      onAddToSpellbook();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md" 
        onClick={handleBackdropClick}
      />
      
      {/* Modal Container */}
      <div className="relative bg-slate-900/95 backdrop-blur-xl border border-slate-600/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative p-6 border-b border-slate-600/50">
          {/* Background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-r ${schoolColor} opacity-10`} />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          
          <div className="relative flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              {/* Level Badge */}
              <div className={`flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br ${levelGradient} shadow-lg border border-white/20`}>
                <span className="text-2xl font-bold text-white">
                  {spell.isCantrip ? '∞' : spell.level}
                </span>
              </div>
              
              <div className="flex-1">
                {/* Spell Name */}
                <h1 className="text-3xl font-bold text-white mb-2 leading-tight">
                  {spell.name}
                </h1>
                
                {/* School and Classes */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`px-3 py-1 rounded-lg bg-gradient-to-r ${schoolColor} text-white text-sm font-medium shadow-md`}>
                    {spell.schoolName}
                  </span>
                  <div className="flex items-center gap-2">
                    <Book className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300 text-sm">
                      {spell.classes.slice(0, 3).map(cls => cls.charAt(0).toUpperCase() + cls.slice(1)).join(', ')}
                      {spell.classes.length > 3 && ` +${spell.classes.length - 3} more`}
                    </span>
                  </div>
                </div>
                
                {/* Status Tags */}
                <div className="flex flex-wrap gap-2">
                  {isInSpellbook && (
                    <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-md border border-green-500/30">
                      ✓ Known
                    </span>
                  )}
                  {isPrepared && (
                    <span className="px-2 py-1 bg-blue-600/20 text-blue-400 text-xs rounded-md border border-blue-500/30">
                      📝 Prepared
                    </span>
                  )}
                  {isFavorite && (
                    <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded-md border border-yellow-500/30">
                      ⭐ Favorite
                    </span>
                  )}
                  {spell.isRitual && (
                    <span className="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs rounded-md border border-amber-500/30">
                      🕯️ Ritual
                    </span>
                  )}
                  {spell.concentration && (
                    <span className="px-2 py-1 bg-red-600/20 text-red-400 text-xs rounded-md border border-red-500/30">
                      🧠 Concentration
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-all"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[60vh]">
          <div className="p-6 space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  <span className="text-sm font-medium text-slate-300">Casting Time</span>
                </div>
                <p className="text-white font-semibold">{spell.castingTime}</p>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="h-5 w-5 text-amber-400" />
                  <span className="text-sm font-medium text-slate-300">Range</span>
                </div>
                <p className="text-white font-semibold">{spell.range}</p>
              </div>
              
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600/30">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <span className="text-sm font-medium text-slate-300">Duration</span>
                </div>
                <p className="text-white font-semibold">{spell.duration}</p>
              </div>
            </div>
            
            {/* Components */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                Components
              </h3>
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {spell.components.verbal && (
                    <span className="w-10 h-10 bg-blue-600/20 text-blue-400 rounded-lg text-sm flex items-center justify-center border border-blue-500/30 font-semibold">
                      V
                    </span>
                  )}
                  {spell.components.somatic && (
                    <span className="w-10 h-10 bg-green-600/20 text-green-400 rounded-lg text-sm flex items-center justify-center border border-green-500/30 font-semibold">
                      S
                    </span>
                  )}
                  {spell.components.material && (
                    <span className="w-10 h-10 bg-purple-600/20 text-purple-400 rounded-lg text-sm flex items-center justify-center border border-purple-500/30 font-semibold">
                      M
                    </span>
                  )}
                </div>
                {spell.components.materialComponent && (
                  <p className="text-slate-300 italic">
                    ({spell.components.materialComponent})
                  </p>
                )}
              </div>
            </div>
            
            {/* Description */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
              <h3 className="text-lg font-semibold text-white mb-3">Description</h3>
              <div className="prose prose-slate prose-invert max-w-none">
                <div 
                  className="text-slate-300 leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: getFormattedHtml(spell.description) 
                  }}
                />
              </div>
            </div>
            
            {/* Higher Level */}
            {spell.higherLevelDescription && (
              <div className="bg-amber-600/10 rounded-lg p-4 border border-amber-500/30">
                <h3 className="text-lg font-semibold text-amber-400 mb-3">At Higher Levels</h3>
                <div 
                  className="text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ 
                    __html: getFormattedHtml(spell.higherLevelDescription) 
                  }}
                />
              </div>
            )}
            
            {/* Source */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-600/30">
              <h3 className="text-lg font-semibold text-white mb-2">Source</h3>
              <p className="text-slate-300">
                {SPELL_SOURCE_BOOKS[spell.source] || spell.source}
                {spell.page && ` (page ${spell.page})`}
              </p>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="p-6 border-t border-slate-600/50 bg-slate-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Favorite Button */}
              {onToggleFavorite && (
                <button
                  onClick={onToggleFavorite}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isFavorite
                      ? 'bg-yellow-600/20 border border-yellow-500/50 text-yellow-300'
                      : 'bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-600/50'
                  }`}
                >
                  <Star size={18} className={isFavorite ? 'fill-current' : ''} />
                  {isFavorite ? 'Favorited' : 'Add to Favorites'}
                </button>
              )}
              
              {/* Prepare Button */}
              {isInSpellbook && (onPrepareSpell || onUnprepareSpell) && (
                <button
                  onClick={isPrepared ? onUnprepareSpell : onPrepareSpell}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isPrepared
                      ? 'bg-blue-600/20 border border-blue-500/50 text-blue-300'
                      : 'bg-slate-700/50 border border-slate-600/50 text-slate-300 hover:bg-slate-600/50'
                  }`}
                >
                  <CheckCircle size={18} />
                  {isPrepared ? 'Prepared' : 'Prepare Spell'}
                </button>
              )}
            </div>
            
            {/* Spellbook Toggle */}
            <button
              onClick={handleToggleSpellbook}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                isInSpellbook
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg'
              }`}
            >
              {isInSpellbook ? (
                <>
                  <CheckCircle size={20} />
                  In Spellbook
                </>
              ) : (
                <>
                  <Plus size={20} />
                  Add to Spellbook
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 