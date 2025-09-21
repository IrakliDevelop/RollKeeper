'use client';

import React, { useState, useMemo } from 'react';
import { Spell, SpellActionType } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  BookOpen, 
  Search,
  Filter,
  Star,
  ChevronDown,
  ChevronRight,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  X,
  Clock,
  Target,
  Zap,
  Book,
  Sparkles
} from 'lucide-react';
import { FancySelect } from '@/components/ui/forms/FancySelect';
import { Modal } from '@/components/ui/feedback/Modal';
import DragDropList from '@/components/ui/layout/DragDropList';

// Constants for spell schools and common casting times
const SPELL_SCHOOLS = [
  'Abjuration',
  'Conjuration',
  'Divination',
  'Enchantment',
  'Evocation',
  'Illusion',
  'Necromancy',
  'Transmutation',
];

const CASTING_TIMES = [
  '1 action',
  '1 bonus action',
  '1 reaction',
  '1 minute',
  '10 minutes',
  '1 hour',
  '8 hours',
  '24 hours',
];

const RANGES = [
  'Self',
  'Touch',
  '5 feet',
  '10 feet',
  '15 feet',
  '30 feet',
  '60 feet',
  '90 feet',
  '120 feet',
  '150 feet',
  '300 feet',
  '500 feet',
  '1 mile',
  'Sight',
  'Unlimited',
];

const DURATIONS = [
  'Instantaneous',
  '1 round',
  '1 minute',
  '10 minutes',
  '1 hour',
  '2 hours',
  '8 hours',
  '24 hours',
  '7 days',
  '10 days',
  '30 days',
  'Until dispelled',
  'Permanent',
];

const ACTION_TYPES = [
  { value: '', label: 'No Action Required' },
  { value: 'attack', label: 'Spell Attack' },
  { value: 'save', label: 'Saving Throw' },
  { value: 'utility', label: 'Utility/Other' },
];

const SAVING_THROWS = [
  'Strength',
  'Dexterity',
  'Constitution',
  'Intelligence',
  'Wisdom',
  'Charisma',
];

const DAMAGE_TYPES = [
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder',
];

interface SpellFormData {
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material: boolean;
    materialDescription: string;
  };
  duration: string;
  description: string;
  higherLevel: string;
  ritual: boolean;
  concentration: boolean;
  isPrepared: boolean;
  isAlwaysPrepared: boolean;
  actionType: SpellActionType | '';
  savingThrow: string;
  damage: string;
  damageType: string;
  source: string;
}

interface SpellFilters {
  searchQuery: string;
  level: number | 'all';
  school: string | 'all';
  actionType: string | 'all';
  prepared: 'all' | 'prepared' | 'unprepared';
  concentration: 'all' | 'yes' | 'no';
  ritual: 'all' | 'yes' | 'no';
  favorites: boolean;
}

interface SpellsByLevel {
  [level: number]: Spell[];
}

const initialFormData: SpellFormData = {
  name: '',
  level: 0,
  school: 'Evocation',
  castingTime: '1 action',
  range: 'Touch',
  components: {
    verbal: false,
    somatic: false,
    material: false,
    materialDescription: '',
  },
  duration: 'Instantaneous',
  description: '',
  higherLevel: '',
  ritual: false,
  concentration: false,
  isPrepared: false,
  isAlwaysPrepared: false,
  actionType: '',
  savingThrow: '',
  damage: '',
  damageType: '',
  source: 'PHB',
};

const initialFilters: SpellFilters = {
  searchQuery: '',
  level: 'all',
  school: 'all',
  actionType: 'all',
  prepared: 'all',
  concentration: 'all',
  ritual: 'all',
  favorites: false,
};

const SpellCard: React.FC<{
  spell: Spell;
  compact: boolean;
  isFavorite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  onTogglePrepared: () => void;
  onToggleFavorite: () => void;
}> = ({ spell, compact, isFavorite, onEdit, onDelete, onView, onTogglePrepared, onToggleFavorite }) => {
  if (compact) {
    return (
      <div className={`flex items-center justify-between rounded-lg border p-3 transition-all hover:shadow-md ${
        spell.isPrepared
          ? 'border-green-400 bg-green-50'
          : 'border-gray-200 bg-gray-50 hover:border-purple-300'
      }`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={onToggleFavorite}
            className={`flex-shrink-0 transition-colors ${
              isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
            }`}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
              spell.level === 0 ? 'bg-yellow-400' : 'bg-purple-400'
            }`} />
            <span className="font-bold text-gray-800 truncate">{spell.name}</span>
            <span className="text-xs text-gray-500 flex-shrink-0">{spell.school}</span>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {spell.level === 0 && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">Cantrip</span>
            )}
            {spell.concentration && (
              <span className="rounded bg-yellow-100 px-1 py-0.5 text-xs text-yellow-800">C</span>
            )}
            {spell.ritual && (
              <span className="rounded bg-purple-100 px-1 py-0.5 text-xs text-purple-800">R</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onTogglePrepared}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              spell.isPrepared
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {spell.isPrepared ? 'Prepared' : 'Prepare'}
          </button>
          <button
            onClick={onView}
            className="rounded p-1 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
            title="View details"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={onEdit}
            className="rounded p-1 text-blue-600 hover:bg-blue-100 hover:text-blue-800"
            title="Edit spell"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-red-600 hover:bg-red-100 hover:text-red-800"
            title="Delete spell"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border p-4 transition-all hover:shadow-md ${
      spell.isPrepared
        ? 'border-green-400 bg-green-50'
        : 'border-gray-200 bg-gray-50 hover:border-purple-300'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={onToggleFavorite}
              className={`transition-colors ${
                isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
              }`}
            >
              <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <h5 className="font-bold text-gray-800">{spell.name}</h5>
            {spell.level === 0 && (
              <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">Cantrip</span>
            )}
            {spell.concentration && (
              <span className="rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Concentration</span>
            )}
            {spell.ritual && (
              <span className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-800">Ritual</span>
            )}
            {spell.isAlwaysPrepared && (
              <span className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-800">Always Prepared</span>
            )}
          </div>
          
          <div className="mb-2 flex items-center gap-4 text-sm text-gray-600">
            <span><strong>School:</strong> {spell.school}</span>
            <span><strong>Time:</strong> {spell.castingTime}</span>
            <span><strong>Range:</strong> {spell.range}</span>
          </div>
          
          <div className="mb-2 text-sm text-gray-600">
            <strong>Components:</strong>{' '}
            {[
              spell.components.verbal && 'V',
              spell.components.somatic && 'S',
              spell.components.material && 'M'
            ].filter(Boolean).join(', ')}
            {spell.components.material && spell.components.materialDescription && (
              <span className="text-gray-500"> ({spell.components.materialDescription})</span>
            )}
          </div>
          
          {spell.damage && (
            <div className="mb-2 text-sm">
              <span className="rounded bg-red-100 px-2 py-1 text-red-800">
                {spell.damage} {spell.damageType}
              </span>
            </div>
          )}
          
          <p className="text-sm text-gray-700 line-clamp-2">{spell.description}</p>
        </div>
        
        <div className="ml-4 flex flex-col gap-2">
          <button
            onClick={onTogglePrepared}
            className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
              spell.isPrepared
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {spell.isPrepared ? 'Prepared' : 'Prepare'}
          </button>
          
          <div className="flex gap-1">
            <button
              onClick={onView}
              className="rounded p-2 text-gray-600 hover:bg-gray-200 hover:text-gray-800"
              title="View details"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={onEdit}
              className="rounded p-2 text-blue-600 hover:bg-blue-100 hover:text-blue-800"
              title="Edit spell"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={onDelete}
              className="rounded p-2 text-red-600 hover:bg-red-100 hover:text-red-800"
              title="Delete spell"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LevelSection: React.FC<{
  level: number;
  spells: Spell[];
  isExpanded: boolean;
  onToggle: () => void;
  compact: boolean;
  favoriteSpells: string[];
  onSpellEdit: (spell: Spell) => void;
  onSpellDelete: (id: string) => void;
  onSpellView: (spell: Spell) => void;
  onTogglePrepared: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onReorder: (sourceIndex: number, destinationIndex: number) => void;
}> = ({
  level,
  spells,
  isExpanded,
  onToggle,
  compact,
  favoriteSpells,
  onSpellEdit,
  onSpellDelete,
  onSpellView,
  onTogglePrepared,
  onToggleFavorite,
  onReorder,
}) => {
  const levelName = level === 0 ? 'Cantrips' : `Level ${level}`;
  const levelColor = level === 0 ? 'text-yellow-600' : 'text-purple-600';
  const levelBg = level === 0 ? 'bg-yellow-50' : 'bg-purple-50';
  const preparedCount = spells.filter(s => s.isPrepared || s.isAlwaysPrepared).length;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 ${levelBg} hover:bg-opacity-80 transition-colors`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <span className={`font-bold ${levelColor}`}>{levelName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-600">
              {spells.length} total
            </span>
            {preparedCount > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                {preparedCount} prepared
              </span>
            )}
          </div>
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-4 bg-white">
          <DragDropList
            items={spells}
            onReorder={onReorder}
            keyExtractor={spell => spell.id}
            className={compact ? 'space-y-2' : 'space-y-3'}
            itemClassName=""
            showDragHandle={true}
            dragHandlePosition="left"
            renderItem={spell => (
              <SpellCard
                spell={spell}
                compact={compact}
                isFavorite={favoriteSpells.includes(spell.id)}
                onEdit={() => onSpellEdit(spell)}
                onDelete={() => onSpellDelete(spell.id)}
                onView={() => onSpellView(spell)}
                onTogglePrepared={() => onTogglePrepared(spell.id)}
                onToggleFavorite={() => onToggleFavorite(spell.id)}
              />
            )}
          />
        </div>
      )}
    </div>
  );
};

export const EnhancedSpellManagement: React.FC = () => {
  const { character, updateCharacter, reorderSpells, toggleSpellFavorite } = useCharacterStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SpellFormData>(initialFormData);
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [filters, setFilters] = useState<SpellFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'level' | 'school'>('level');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0, 1, 2]));

  // Get favorite spells
  const favoriteSpells = useMemo(() => {
    return character.spellbook?.favoriteSpells || [];
  }, [character.spellbook?.favoriteSpells]);

  // Apply filters and search
  const filteredSpells = useMemo(() => {
    let filtered = character.spells;

    // Search query
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(spell =>
        spell.name.toLowerCase().includes(query) ||
        spell.school.toLowerCase().includes(query) ||
        spell.description.toLowerCase().includes(query) ||
        spell.damageType?.toLowerCase().includes(query)
      );
    }

    // Level filter
    if (filters.level !== 'all') {
      filtered = filtered.filter(spell => spell.level === filters.level);
    }

    // School filter
    if (filters.school !== 'all') {
      filtered = filtered.filter(spell => spell.school === filters.school);
    }

    // Action type filter
    if (filters.actionType !== 'all') {
      filtered = filtered.filter(spell => spell.actionType === filters.actionType);
    }

    // Prepared filter
    if (filters.prepared === 'prepared') {
      filtered = filtered.filter(spell => spell.isPrepared || spell.isAlwaysPrepared);
    } else if (filters.prepared === 'unprepared') {
      filtered = filtered.filter(spell => !spell.isPrepared && !spell.isAlwaysPrepared);
    }

    // Concentration filter
    if (filters.concentration === 'yes') {
      filtered = filtered.filter(spell => spell.concentration);
    } else if (filters.concentration === 'no') {
      filtered = filtered.filter(spell => !spell.concentration);
    }

    // Ritual filter
    if (filters.ritual === 'yes') {
      filtered = filtered.filter(spell => spell.ritual);
    } else if (filters.ritual === 'no') {
      filtered = filtered.filter(spell => !spell.ritual);
    }

    // Favorites filter
    if (filters.favorites) {
      filtered = filtered.filter(spell => favoriteSpells.includes(spell.id));
    }

    return filtered;
  }, [character.spells, filters, favoriteSpells]);

  // Sort spells
  const sortedSpells = useMemo(() => {
    return [...filteredSpells].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'level':
          comparison = a.level - b.level;
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
          break;
        case 'school':
          comparison = a.school.localeCompare(b.school);
          if (comparison === 0) {
            comparison = a.name.localeCompare(b.name);
          }
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredSpells, sortBy, sortOrder]);

  // Group spells by level
  const spellsByLevel = useMemo(() => {
    const grouped: SpellsByLevel = {};
    
    sortedSpells.forEach(spell => {
      if (!grouped[spell.level]) {
        grouped[spell.level] = [];
      }
      grouped[spell.level].push(spell);
    });

    return grouped;
  }, [sortedSpells]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return;

    const spellData: Omit<Spell, 'id' | 'createdAt' | 'updatedAt'> = {
      ...formData,
      higherLevel: formData.higherLevel || undefined,
      ritual: formData.ritual || undefined,
      concentration: formData.concentration || undefined,
      isPrepared: formData.isPrepared || undefined,
      isAlwaysPrepared: formData.isAlwaysPrepared || undefined,
      actionType: formData.actionType || undefined,
      savingThrow: formData.savingThrow || undefined,
      damage: formData.damage || undefined,
      damageType: formData.damageType || undefined,
      source: formData.source || undefined,
    };

    if (editingId) {
      const updatedSpells = character.spells.map(spell =>
        spell.id === editingId
          ? { ...spell, ...spellData, updatedAt: new Date().toISOString() }
          : spell
      );
      updateCharacter({ spells: updatedSpells });
    } else {
      const newSpell: Spell = {
        ...spellData,
        id: `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateCharacter({ spells: [...character.spells, newSpell] });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setIsFormOpen(false);
    setEditingId(null);
  };

  const handleEdit = (spell: Spell) => {
    setFormData({
      name: spell.name,
      level: spell.level,
      school: spell.school,
      castingTime: spell.castingTime,
      range: spell.range,
      components: {
        ...spell.components,
        materialDescription: spell.components.materialDescription || '',
      },
      duration: spell.duration,
      description: spell.description,
      higherLevel: spell.higherLevel || '',
      ritual: spell.ritual || false,
      concentration: spell.concentration || false,
      isPrepared: spell.isPrepared || false,
      isAlwaysPrepared: spell.isAlwaysPrepared || false,
      actionType: spell.actionType || '',
      savingThrow: spell.savingThrow || '',
      damage: spell.damage || '',
      damageType: spell.damageType || '',
      source: spell.source || 'PHB',
    });
    setEditingId(spell.id);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this spell?')) {
      const updatedSpells = character.spells.filter(spell => spell.id !== id);
      updateCharacter({ spells: updatedSpells });
    }
  };

  const handlePreparedToggle = (id: string) => {
    const updatedSpells = character.spells.map(spell =>
      spell.id === id
        ? {
            ...spell,
            isPrepared: !spell.isPrepared,
            updatedAt: new Date().toISOString(),
          }
        : spell
    );
    updateCharacter({ spells: updatedSpells });
  };

  const handleReorderSpellsInLevel = (level: number) => (sourceIndex: number, destinationIndex: number) => {
    const spellsInLevel = spellsByLevel[level];
    const sourceSpellId = spellsInLevel[sourceIndex].id;
    const destinationSpellId = spellsInLevel[destinationIndex].id;

    const sourceGlobalIndex = character.spells.findIndex(spell => spell.id === sourceSpellId);
    const destinationGlobalIndex = character.spells.findIndex(spell => spell.id === destinationSpellId);

    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      reorderSpells(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  const toggleLevelExpanded = (level: number) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  const clearFilters = () => {
    setFilters(initialFilters);
  };

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'searchQuery') return value.trim() !== '';
    if (typeof value === 'boolean') return value;
    return value !== 'all';
  }).length;

  const sortedLevels = Object.keys(spellsByLevel).map(Number).sort((a, b) => a - b);

  return (
    <div className="rounded-lg border border-purple-200 bg-white p-6 shadow">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-xl font-bold text-purple-800">
            <span className="text-purple-600">📚</span>
            Spells & Cantrips
            <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
              {filteredSpells.length} of {character.spells.length}
            </span>
          </h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompactView(!compactView)}
              className={`rounded p-2 transition-colors ${
                compactView
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={compactView ? 'Switch to detailed view' : 'Switch to compact view'}
            >
              {compactView ? <List size={18} /> : <Grid3X3 size={18} />}
            </button>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 rounded px-3 py-2 transition-colors ${
                showFilters || activeFilterCount > 0
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter size={16} />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700"
            >
              <Plus size={16} />
              Add Spell
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search spells by name, school, description, or damage type..."
            value={filters.searchQuery}
            onChange={(e) => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-4 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-semibold text-gray-800">Advanced Filters</h4>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-200"
                  >
                    <X size={14} />
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(false)}
                  className="rounded p-1 text-gray-600 hover:bg-gray-200"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Level Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Level</label>
                <FancySelect
                  options={[
                    { value: 'all', label: 'All Levels' },
                    { value: 0, label: 'Cantrips' },
                    ...Array.from({ length: 9 }, (_, i) => ({
                      value: i + 1,
                      label: `Level ${i + 1}`,
                    })),
                  ]}
                  value={filters.level}
                  onChange={value => setFilters(prev => ({ ...prev, level: value as number | 'all' }))}
                  color="purple"
                  className="w-full"
                />
              </div>

              {/* School Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">School</label>
                <FancySelect
                  options={[
                    { value: 'all', label: 'All Schools' },
                    ...SPELL_SCHOOLS.map(school => ({ value: school, label: school })),
                  ]}
                  value={filters.school}
                  onChange={value => setFilters(prev => ({ ...prev, school: value as string }))}
                  color="purple"
                  className="w-full"
                />
              </div>

              {/* Action Type Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Action Type</label>
                <FancySelect
                  options={[
                    { value: 'all', label: 'All Types' },
                    ...ACTION_TYPES.map(type => ({ value: type.value, label: type.label })),
                  ]}
                  value={filters.actionType}
                  onChange={value => setFilters(prev => ({ ...prev, actionType: value as string }))}
                  color="purple"
                  className="w-full"
                />
              </div>

              {/* Prepared Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Preparation</label>
                <FancySelect
                  options={[
                    { value: 'all', label: 'All Spells' },
                    { value: 'prepared', label: 'Prepared Only' },
                    { value: 'unprepared', label: 'Unprepared Only' },
                  ]}
                  value={filters.prepared}
                  onChange={value => setFilters(prev => ({ ...prev, prepared: value as 'all' | 'prepared' | 'unprepared' }))}
                  color="purple"
                  className="w-full"
                />
              </div>

              {/* Concentration Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Concentration</label>
                <FancySelect
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'yes', label: 'Concentration' },
                    { value: 'no', label: 'No Concentration' },
                  ]}
                  value={filters.concentration}
                  onChange={value => setFilters(prev => ({ ...prev, concentration: value as 'all' | 'yes' | 'no' }))}
                  color="purple"
                  className="w-full"
                />
              </div>

              {/* Ritual Filter */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ritual</label>
                <FancySelect
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'yes', label: 'Ritual' },
                    { value: 'no', label: 'No Ritual' },
                  ]}
                  value={filters.ritual}
                  onChange={value => setFilters(prev => ({ ...prev, ritual: value as 'all' | 'yes' | 'no' }))}
                  color="purple"
                  className="w-full"
                />
              </div>

              {/* Sort Options */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Sort By</label>
                <div className="flex gap-1">
                  <FancySelect
                    options={[
                      { value: 'level', label: 'Level' },
                      { value: 'name', label: 'Name' },
                      { value: 'school', label: 'School' },
                    ]}
                    value={sortBy}
                    onChange={value => setSortBy(value as 'name' | 'level' | 'school')}
                    color="purple"
                    className="flex-1"
                  />
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="rounded border border-gray-300 p-2 hover:bg-gray-100"
                    title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                  </button>
                </div>
              </div>

              {/* Favorites Toggle */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.favorites}
                    onChange={(e) => setFilters(prev => ({ ...prev, favorites: e.target.checked }))}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Favorites Only</span>
                  <Star size={16} className="text-yellow-500" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spell List */}
      <div className="space-y-4">
        {character.spells.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <BookOpen size={64} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No spells added yet</p>
            <p className="mt-2 text-sm">
              Click &quot;Add Spell&quot; to get started building your spellbook
            </p>
          </div>
        ) : filteredSpells.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Search size={64} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No spells match your filters</p>
            <p className="mt-2 text-sm">
              Try adjusting your search terms or clearing some filters
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-4 rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          sortedLevels.map(level => (
            <LevelSection
              key={level}
              level={level}
              spells={spellsByLevel[level]}
              isExpanded={expandedLevels.has(level)}
              onToggle={() => toggleLevelExpanded(level)}
              compact={compactView}
              favoriteSpells={favoriteSpells}
              onSpellEdit={handleEdit}
              onSpellDelete={handleDelete}
              onSpellView={setViewingSpell}
              onTogglePrepared={handlePreparedToggle}
              onToggleFavorite={toggleSpellFavorite}
              onReorder={handleReorderSpellsInLevel(level)}
            />
          ))
        )}
      </div>

      {/* Add/Edit Spell Modal */}
      {isFormOpen && (
        <Modal
          isOpen={isFormOpen}
          onClose={resetForm}
          title={editingId ? 'Edit Spell' : 'Add New Spell'}
          size="lg"
          closeOnBackdropClick={true}
          className="overflow-y-auto"
        >

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Spell Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Level
                    </label>
                    <select
                      value={formData.level}
                      onChange={e => setFormData(prev => ({ ...prev, level: parseInt(e.target.value) }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      <option value={0}>Cantrip</option>
                      {Array.from({ length: 9 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Level {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      School
                    </label>
                    <select
                      value={formData.school}
                      onChange={e => setFormData(prev => ({ ...prev, school: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      {SPELL_SCHOOLS.map(school => (
                        <option key={school} value={school}>
                          {school}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Casting Time
                    </label>
                    <select
                      value={formData.castingTime}
                      onChange={e => setFormData(prev => ({ ...prev, castingTime: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      {CASTING_TIMES.map(time => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Range
                    </label>
                    <select
                      value={formData.range}
                      onChange={e => setFormData(prev => ({ ...prev, range: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      {RANGES.map(range => (
                        <option key={range} value={range}>
                          {range}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Duration
                    </label>
                    <select
                      value={formData.duration}
                      onChange={e => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      {DURATIONS.map(duration => (
                        <option key={duration} value={duration}>
                          {duration}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Components */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Components
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.components.verbal}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          components: { ...prev.components, verbal: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Verbal (V)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.components.somatic}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          components: { ...prev.components, somatic: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Somatic (S)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.components.material}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          components: { ...prev.components, material: e.target.checked }
                        }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Material (M)</span>
                    </label>
                  </div>
                  {formData.components.material && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Material component description..."
                        value={formData.components.materialDescription}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          components: { ...prev.components, materialDescription: e.target.value }
                        }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    required
                  />
                </div>

                {/* Higher Level */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    At Higher Levels
                  </label>
                  <textarea
                    value={formData.higherLevel}
                    onChange={e => setFormData(prev => ({ ...prev, higherLevel: e.target.value }))}
                    rows={2}
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    placeholder="Describe what happens when cast at higher levels..."
                  />
                </div>

                {/* Action Type and Damage */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Action Type
                    </label>
                    <select
                      value={formData.actionType}
                      onChange={e => setFormData(prev => ({ ...prev, actionType: e.target.value as SpellActionType | '' }))}
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    >
                      {ACTION_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formData.actionType === 'save' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Saving Throw
                      </label>
                      <select
                        value={formData.savingThrow}
                        onChange={e => setFormData(prev => ({ ...prev, savingThrow: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      >
                        <option value="">Select...</option>
                        {SAVING_THROWS.map(save => (
                          <option key={save} value={save}>
                            {save}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Damage */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Damage Dice
                    </label>
                    <input
                      type="text"
                      value={formData.damage}
                      onChange={e => setFormData(prev => ({ ...prev, damage: e.target.value }))}
                      placeholder="e.g., 1d8, 3d6"
                      className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>

                  {formData.damage && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Damage Type
                      </label>
                      <select
                        value={formData.damageType}
                        onChange={e => setFormData(prev => ({ ...prev, damageType: e.target.value }))}
                        className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                      >
                        <option value="">Select...</option>
                        {DAMAGE_TYPES.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Flags */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Spell Properties
                  </label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.ritual}
                        onChange={e => setFormData(prev => ({ ...prev, ritual: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Ritual</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.concentration}
                        onChange={e => setFormData(prev => ({ ...prev, concentration: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Concentration</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.isPrepared}
                        onChange={e => setFormData(prev => ({ ...prev, isPrepared: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Prepared</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.isAlwaysPrepared}
                        onChange={e => setFormData(prev => ({ ...prev, isAlwaysPrepared: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm font-medium text-gray-800">Always Prepared</span>
                    </label>
                  </div>
                </div>

                {/* Source */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Source
                  </label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
                    placeholder="e.g., PHB, XGE, TCE"
                    className="w-full rounded border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
                  >
                    {editingId ? 'Update Spell' : 'Add Spell'}
                  </button>
                </div>
              </form>
        </Modal>
      )}

      {/* View Spell Modal - Redesigned with Dark Theme */}
      {viewingSpell && (
        <Modal
          isOpen={viewingSpell !== null}
          onClose={() => setViewingSpell(null)}
          title=""
          size="xl"
          closeOnBackdropClick={true}
        >
          <div className="space-y-6">
            {/* Header with spell name and level */}
            <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{viewingSpell.name}</h2>
                  <div className="mt-2 flex items-center gap-3">
                    {viewingSpell.level === 0 ? (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                        Cantrip
                      </span>
                    ) : (
                      <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
                        Level {viewingSpell.level}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
                      {viewingSpell.school}
                    </span>
                    {viewingSpell.ritual && (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                        Ritual
                      </span>
                    )}
                    {viewingSpell.concentration && (
                      <span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800">
                        Concentration
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {viewingSpell.isPrepared && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800">
                      Prepared
                    </span>
                  )}
                  {viewingSpell.isAlwaysPrepared && (
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-800">
                      Always Prepared
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Spell Details Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Casting Information */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-blue-800">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Casting Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Casting Time:</span>
                    <span className="text-gray-900">{viewingSpell.castingTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Range:</span>
                    <span className="text-gray-900">{viewingSpell.range}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Duration:</span>
                    <span className="text-gray-900">{viewingSpell.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600">Source:</span>
                    <span className="text-gray-900">{viewingSpell.source || 'Unknown'}</span>
                  </div>
                </div>
              </div>

              {/* Components */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-amber-800">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                  Components
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  {viewingSpell.components.verbal && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-300 bg-blue-100 text-sm font-semibold text-blue-700">
                      V
                    </span>
                  )}
                  {viewingSpell.components.somatic && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-300 bg-green-100 text-sm font-semibold text-green-700">
                      S
                    </span>
                  )}
                  {viewingSpell.components.material && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-300 bg-purple-100 text-sm font-semibold text-purple-700">
                      M
                    </span>
                  )}
                </div>
                {viewingSpell.components.material && viewingSpell.components.materialDescription && (
                  <p className="text-sm text-gray-700 italic">
                    ({viewingSpell.components.materialDescription})
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-emerald-800">
                <Book className="h-5 w-5 text-emerald-600" />
                Description
              </h3>
              <div className="prose max-w-none">
                <p className="leading-relaxed text-gray-800">{viewingSpell.description}</p>
              </div>
            </div>

            {/* Higher Level */}
            {viewingSpell.higherLevel && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-orange-800">
                  <Zap className="h-5 w-5 text-orange-600" />
                  At Higher Levels
                </h3>
                <p className="leading-relaxed text-gray-800">{viewingSpell.higherLevel}</p>
              </div>
            )}

            {/* Combat Information */}
            {(viewingSpell.actionType === 'attack' || viewingSpell.actionType === 'save' || viewingSpell.damage) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-red-800">
                  <Target className="h-5 w-5 text-red-600" />
                  Combat Details
                </h3>
                <div className="space-y-2">
                  {viewingSpell.damage && (
                    <div>
                      <span className="font-medium text-gray-600">Damage:</span>{' '}
                      <span className="text-gray-900 font-semibold">{viewingSpell.damage} {viewingSpell.damageType}</span>
                    </div>
                  )}
                  {viewingSpell.actionType === 'save' && viewingSpell.savingThrow && (
                    <div>
                      <span className="font-medium text-gray-600">Saving Throw:</span>{' '}
                      <span className="text-gray-900 font-semibold">{viewingSpell.savingThrow}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
