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
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Checkbox } from '@/components/ui/forms/checkbox';
import { Modal } from '@/components/ui/feedback/Modal';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
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
  const isCantrip = spell.level === 0;
  
  if (compact) {
    return (
      <div className={`flex items-center justify-between rounded-lg border-2 p-3 transition-all hover:shadow-md ${
        spell.isPrepared
          ? 'border-green-300 bg-white'
          : 'border-gray-200 bg-white hover:border-purple-300'
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
            <span className="font-bold text-gray-800 truncate">{spell.name}</span>
            <Badge 
              variant={isCantrip ? "warning" : "primary"} 
              size="sm"
              className={isCantrip ? "bg-yellow-100 text-yellow-800 flex-shrink-0" : "bg-purple-100 text-purple-800 flex-shrink-0"}
            >
              {isCantrip ? 'Cantrip' : `Lv${spell.level}`}
            </Badge>
            <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:inline">{spell.school}</span>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            {spell.concentration && (
              <Badge variant="warning" size="sm">C</Badge>
            )}
            {spell.ritual && (
              <Badge variant="secondary" size="sm">R</Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          <Button
            onClick={onTogglePrepared}
            variant={spell.isPrepared ? "success" : "outline"}
            size="xs"
          >
            {spell.isPrepared ? 'Prepared' : 'Prepare'}
          </Button>
          <Button
            onClick={onView}
            variant="ghost"
            size="xs"
            title="View details"
          >
            <Eye size={14} />
          </Button>
          <Button
            onClick={onEdit}
            variant="ghost"
            size="xs"
            title="Edit spell"
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          >
            <Edit2 size={14} />
          </Button>
          <Button
            onClick={onDelete}
            variant="ghost"
            size="xs"
            title="Delete spell"
            className="text-red-600 hover:text-red-800 hover:bg-red-50"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-2 p-4 transition-all hover:shadow-md ${
      spell.isPrepared
        ? 'border-green-300 bg-white'
        : 'border-gray-200 bg-white hover:border-purple-300'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <button
              onClick={onToggleFavorite}
              className={`transition-colors ${
                isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'
              }`}
            >
              <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <h5 className="font-bold text-gray-800">{spell.name}</h5>
            <Badge 
              variant={isCantrip ? "warning" : "primary"} 
              size="sm"
              className={isCantrip ? "bg-yellow-100 text-yellow-800" : "bg-purple-100 text-purple-800"}
            >
              {isCantrip ? 'Cantrip' : `Level ${spell.level}`}
            </Badge>
            {spell.concentration && (
              <Badge variant="warning" size="sm">Concentration</Badge>
            )}
            {spell.ritual && (
              <Badge variant="secondary" size="sm">Ritual</Badge>
            )}
            {spell.isAlwaysPrepared && (
              <Badge variant="info" size="sm">Always Prepared</Badge>
            )}
          </div>
          
          <div className="mb-2 flex items-center gap-4 text-sm text-gray-600 flex-wrap">
            <span><strong>School:</strong> {spell.school}</span>
            <span><strong>Time:</strong> {spell.castingTime}</span>
            <span><strong>Range:</strong> {spell.range}</span>
            {spell.duration && <span><strong>Duration:</strong> {spell.duration}</span>}
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
            <div className="mb-2">
              <Badge variant="danger" size="sm">
                {spell.damage} {spell.damageType}
              </Badge>
            </div>
          )}
          
          <p className="text-sm text-gray-700 line-clamp-2">{spell.description}</p>
        </div>
        
        <div className="ml-4 flex flex-col gap-2">
          <Button
            onClick={onTogglePrepared}
            variant={spell.isPrepared ? "success" : "outline"}
            size="sm"
          >
            {spell.isPrepared ? 'Prepared' : 'Prepare'}
          </Button>
          
          <div className="flex gap-1">
            <Button
              onClick={onView}
              variant="outline"
              size="sm"
              title="View details"
            >
              <Eye size={16} />
            </Button>
            <Button
              onClick={onEdit}
              variant="outline"
              size="sm"
              title="Edit spell"
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Edit2 size={16} />
            </Button>
            <Button
              onClick={onDelete}
              variant="outline"
              size="sm"
              title="Delete spell"
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </Button>
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
  const isCantrip = level === 0;
  const levelName = isCantrip ? 'Cantrips' : `Level ${level}`;
  const levelColor = isCantrip ? 'text-yellow-700' : 'text-purple-700';
  const levelBg = isCantrip ? 'bg-gradient-to-r from-yellow-50 to-amber-50' : 'bg-gradient-to-r from-purple-50 to-violet-50';
  const borderColor = isCantrip ? 'border-yellow-200' : 'border-purple-200';
  const preparedCount = spells.filter(s => s.isPrepared || s.isAlwaysPrepared).length;

  return (
    <div className={`border-2 ${borderColor} rounded-lg overflow-hidden bg-white`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 ${levelBg} hover:opacity-90 transition-all`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown size={18} className={levelColor} />
            ) : (
              <ChevronRight size={18} className={levelColor} />
            )}
            <span className={`font-bold text-base ${levelColor}`}>{levelName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant={isCantrip ? "warning" : "primary"}
              size="sm"
              className={isCantrip ? "bg-yellow-100 text-yellow-800" : "bg-purple-100 text-purple-800"}
            >
              {spells.length} spell{spells.length !== 1 ? 's' : ''}
            </Badge>
            {preparedCount > 0 && (
              <Badge variant="success" size="sm" className="bg-green-100 text-green-800">
                {preparedCount} prepared
              </Badge>
            )}
          </div>
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-4 bg-white border-t-2 border-gray-100">
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
          <h3 className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <BookOpen className="text-purple-600" size={24} />
            Spells & Cantrips
            <Badge variant="secondary" size="sm">
              {filteredSpells.length} of {character.spells.length}
            </Badge>
          </h3>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCompactView(!compactView)}
              variant={compactView ? "primary" : "ghost"}
              size="sm"
              title={compactView ? 'Switch to detailed view' : 'Switch to compact view'}
              className={compactView ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              {compactView ? <List size={18} /> : <Grid3X3 size={18} />}
            </Button>
            
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant={showFilters || activeFilterCount > 0 ? "primary" : "ghost"}
              size="sm"
              leftIcon={<Filter size={16} />}
              className={showFilters || activeFilterCount > 0 ? "bg-purple-600 hover:bg-purple-700" : ""}
            >
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="danger" size="sm" className="ml-1 bg-red-600 text-white">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            
            <Button
              onClick={() => setIsFormOpen(true)}
              variant="primary"
              size="sm"
              leftIcon={<Plus size={16} />}
              className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
            >
              Add Spell
            </Button>
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
            className="w-full rounded-lg border-2 border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
          />
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="rounded-lg border-2 border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-bold text-gray-800">Advanced Filters</h4>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <Button
                    onClick={clearFilters}
                    variant="ghost"
                    size="sm"
                    leftIcon={<X size={14} />}
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  onClick={() => setShowFilters(false)}
                  variant="ghost"
                  size="sm"
                >
                  <X size={16} />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Level Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Level</label>
                <SelectField
                  value={filters.level.toString()}
                  onValueChange={value => setFilters(prev => ({ ...prev, level: value === 'all' ? 'all' : parseInt(value) }))}
                >
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="0">Cantrips</SelectItem>
                  {Array.from({ length: 9 }, (_, i) => (
                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                      Level {i + 1}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              {/* School Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">School</label>
                <SelectField
                  value={filters.school}
                  onValueChange={value => setFilters(prev => ({ ...prev, school: value }))}
                >
                  <SelectItem value="all">All Schools</SelectItem>
                  {SPELL_SCHOOLS.map(school => (
                    <SelectItem key={school} value={school}>{school}</SelectItem>
                  ))}
                </SelectField>
              </div>

              {/* Action Type Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Action Type</label>
                <SelectField
                  value={filters.actionType}
                  onValueChange={value => setFilters(prev => ({ ...prev, actionType: value }))}
                >
                  <SelectItem value="all">All Types</SelectItem>
                  {ACTION_TYPES.map(type => (
                    <SelectItem key={type.value || 'none'} value={type.value || 'none'}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>

              {/* Prepared Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Preparation</label>
                <SelectField
                  value={filters.prepared}
                  onValueChange={value => setFilters(prev => ({ ...prev, prepared: value as 'all' | 'prepared' | 'unprepared' }))}
                >
                  <SelectItem value="all">All Spells</SelectItem>
                  <SelectItem value="prepared">Prepared Only</SelectItem>
                  <SelectItem value="unprepared">Unprepared Only</SelectItem>
                </SelectField>
              </div>

              {/* Concentration Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Concentration</label>
                <SelectField
                  value={filters.concentration}
                  onValueChange={value => setFilters(prev => ({ ...prev, concentration: value as 'all' | 'yes' | 'no' }))}
                >
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Concentration</SelectItem>
                  <SelectItem value="no">No Concentration</SelectItem>
                </SelectField>
              </div>

              {/* Ritual Filter */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Ritual</label>
                <SelectField
                  value={filters.ritual}
                  onValueChange={value => setFilters(prev => ({ ...prev, ritual: value as 'all' | 'yes' | 'no' }))}
                >
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Ritual</SelectItem>
                  <SelectItem value="no">No Ritual</SelectItem>
                </SelectField>
              </div>

              {/* Sort Options */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Sort By</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <SelectField
                      value={sortBy}
                      onValueChange={value => setSortBy(value as 'name' | 'level' | 'school')}
                    >
                      <SelectItem value="level">Level</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="school">School</SelectItem>
                    </SelectField>
                  </div>
                  <Button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    variant="outline"
                    size="md"
                    title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                  </Button>
                </div>
              </div>

              {/* Favorites Toggle */}
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={filters.favorites}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, favorites: checked as boolean }))}
                  />
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                    Favorites Only
                    <Star size={16} className="text-yellow-500" />
                  </span>
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
              <Button
                onClick={clearFilters}
                variant="primary"
                size="md"
                className="mt-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                Clear All Filters
              </Button>
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

      {/* View Spell Modal - Using unified SpellDetailsModal */}
      {viewingSpell && (
        <SpellDetailsModal
          spell={viewingSpell}
          isOpen={true}
          onClose={() => setViewingSpell(null)}
          isFavorite={favoriteSpells.includes(viewingSpell.id)}
          onToggleFavorite={() => toggleSpellFavorite(viewingSpell.id)}
        />
      )}
    </div>
  );
};
