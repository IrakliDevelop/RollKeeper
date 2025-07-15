'use client';

import React, { useState } from 'react';
import { Spell, SpellActionType } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Edit2, Trash2, Eye, BookOpen } from 'lucide-react';
import { FancySelect } from '@/components/ui/FancySelect';
import { ModalPortal } from '@/components/ui/ModalPortal';

// Constants for spell schools and common casting times
const SPELL_SCHOOLS = [
  'Abjuration', 'Conjuration', 'Divination', 'Enchantment', 
  'Evocation', 'Illusion', 'Necromancy', 'Transmutation'
];

const CASTING_TIMES = [
  '1 action', '1 bonus action', '1 reaction', '1 minute', 
  '10 minutes', '1 hour', '8 hours', '24 hours'
];

const RANGES = [
  'Self', 'Touch', '5 feet', '10 feet', '15 feet', '30 feet', 
  '60 feet', '90 feet', '120 feet', '150 feet', '300 feet', 
  '500 feet', '1 mile', 'Sight', 'Unlimited'
];

const DURATIONS = [
  'Instantaneous', '1 round', '1 minute', '10 minutes', 
  '1 hour', '2 hours', '8 hours', '24 hours', '7 days', 
  '10 days', '30 days', 'Until dispelled', 'Permanent'
];

const ACTION_TYPES = [
  { value: '', label: 'No Action Required' },
  { value: 'attack', label: 'Spell Attack' },
  { value: 'save', label: 'Saving Throw' },
  { value: 'utility', label: 'Utility/Other' }
];

const SAVING_THROWS = [
  'Strength', 'Dexterity', 'Constitution', 
  'Intelligence', 'Wisdom', 'Charisma'
];

const DAMAGE_TYPES = [
  'Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 
  'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 
  'Slashing', 'Thunder'
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

export const SpellManagement: React.FC = () => {
  const { character, updateCharacter } = useCharacterStore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<SpellFormData>(initialFormData);
  const [viewingSpell, setViewingSpell] = useState<Spell | null>(null);
  const [filterLevel, setFilterLevel] = useState<number | 'all'>('all');

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
        materialDescription: spell.components.materialDescription || '' 
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
        ? { ...spell, isPrepared: !spell.isPrepared, updatedAt: new Date().toISOString() }
        : spell
    );
    updateCharacter({ spells: updatedSpells });
  };

  // Filter spells by level
  const filteredSpells = character.spells.filter(spell => 
    filterLevel === 'all' || spell.level === filterLevel
  );

  // Group spells by level
  const spellsByLevel = filteredSpells.reduce((acc, spell) => {
    const level = spell.level;
    if (!acc[level]) acc[level] = [];
    acc[level].push(spell);
    return acc;
  }, {} as Record<number, Spell[]>);

  const getLevelName = (level: number) => {
    return level === 0 ? 'Cantrips' : `Level ${level}`;
  };

  return (
    <div className="bg-white rounded-lg shadow border border-purple-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
            <span className="text-purple-600">📚</span>
            Spells & Cantrips
          </h3>
          
          {/* Level Filter */}
          <FancySelect
            options={[
              { value: 'all', label: 'All Levels' },
              { value: 0, label: 'Cantrips', description: 'Unlimited use spells' },
              ...Array.from({ length: 9 }, (_, i) => ({
                value: i + 1,
                label: `Level ${i + 1}`,
                description: i === 0 ? 'First level spells' : i === 8 ? 'Ninth level spells' : `${['Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'][i-1]} level spells`
              }))
            ]}
            value={filterLevel}
            onChange={(value) => setFilterLevel(value === 'all' ? 'all' : value as number)}
            color="purple"
            className="w-40"
          />
        </div>
        
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
        >
          <Plus size={16} />
          Add Spell
        </button>
      </div>

      {/* Spell List */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {character.spells.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <BookOpen size={48} className="mx-auto mb-2 text-gray-400" />
            <p>No spells added yet</p>
            <p className="text-sm mt-1">Click &quot;Add Spell&quot; to get started</p>
          </div>
        ) : Object.keys(spellsByLevel).sort((a, b) => parseInt(a) - parseInt(b)).map(levelStr => {
          const level = parseInt(levelStr);
          const spells = spellsByLevel[level];
          
          return (
            <div key={level} className="space-y-2">
              <h4 className="font-semibold text-purple-800 border-b border-purple-200 pb-1">
                {getLevelName(level)} ({spells.length})
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {spells.map((spell) => (
                  <div
                    key={spell.id}
                    className={`p-3 rounded-lg border transition-all hover:shadow-md ${
                      spell.isPrepared
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 bg-gray-50 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-bold text-gray-800">{spell.name}</h5>
                          {spell.level === 0 && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              Cantrip
                            </span>
                          )}
                          {spell.concentration && (
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                              Concentration
                            </span>
                          )}
                          {spell.ritual && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">
                              Ritual
                            </span>
                          )}
                          {spell.isAlwaysPrepared && (
                            <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded">
                              Always Prepared
                            </span>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">{spell.school}</span> • 
                          <span className="ml-1">{spell.castingTime}</span> • 
                          <span className="ml-1">{spell.range}</span>
                        </div>
                        
                        <div className="text-xs text-gray-500">
                          Components: {[
                            spell.components.verbal && 'V',
                            spell.components.somatic && 'S',
                            spell.components.material && 'M'
                          ].filter(Boolean).join(', ') || 'None'}
                          {spell.components.material && spell.components.materialDescription && (
                            <span className="ml-1">({spell.components.materialDescription})</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center gap-1 ml-3">
                        <button
                          onClick={() => setViewingSpell(spell)}
                          className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        
                        {spell.level > 0 && !spell.isAlwaysPrepared && (
                          <button
                            onClick={() => handlePreparedToggle(spell.id)}
                            className={`px-2 py-1 text-xs rounded transition-colors ${
                              spell.isPrepared
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                            }`}
                          >
                            {spell.isPrepared ? 'Prepared' : 'Prepare'}
                          </button>
                        )}
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(spell)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(spell.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Spell Form Modal */}
      <ModalPortal isOpen={isFormOpen}>
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && resetForm()}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
        >
          <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-purple-200 transform animate-in zoom-in-95 fade-in-0 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-purple-800 mb-6 flex items-center gap-2">
                <span className="text-purple-600">✨</span>
                {editingId ? 'Edit Spell' : 'Add New Spell'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">📖</span>
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-800 mb-1">Spell Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                        placeholder="e.g., Fireball"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">Level</label>
                      <FancySelect
                        options={[
                          { value: 0, label: 'Cantrip', description: 'Unlimited use spell' },
                          ...Array.from({ length: 9 }, (_, i) => ({
                            value: i + 1,
                            label: `Level ${i + 1}`,
                            description: `${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} level spell slot required`
                          }))
                        ]}
                        value={formData.level}
                        onChange={(value) => setFormData(prev => ({ ...prev, level: value as number }))}
                        color="purple"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">School</label>
                      <select
                        value={formData.school}
                        onChange={(e) => setFormData(prev => ({ ...prev, school: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                      >
                        {SPELL_SCHOOLS.map(school => (
                          <option key={school} value={school}>{school}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Casting Details */}
                <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">⏱️</span>
                    Casting Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">Casting Time</label>
                      <select
                        value={formData.castingTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, castingTime: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                      >
                        {CASTING_TIMES.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">Range</label>
                      <select
                        value={formData.range}
                        onChange={(e) => setFormData(prev => ({ ...prev, range: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                      >
                        {RANGES.map(range => (
                          <option key={range} value={range}>{range}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">Duration</label>
                      <select
                        value={formData.duration}
                        onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                      >
                        {DURATIONS.map(duration => (
                          <option key={duration} value={duration}>{duration}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Components */}
                <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">🔮</span>
                    Components
                  </h4>
                  <div className="space-y-3">
                    <div className="flex gap-6">
                      <label className="flex items-center text-sm font-medium text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.components.verbal}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            components: { ...prev.components, verbal: e.target.checked }
                          }))}
                          className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Verbal (V)
                      </label>
                      <label className="flex items-center text-sm font-medium text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.components.somatic}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            components: { ...prev.components, somatic: e.target.checked }
                          }))}
                          className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Somatic (S)
                      </label>
                      <label className="flex items-center text-sm font-medium text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.components.material}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            components: { ...prev.components, material: e.target.checked }
                          }))}
                          className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Material (M)
                      </label>
                    </div>
                    
                    {formData.components.material && (
                      <div>
                        <label className="block text-sm font-medium text-gray-800 mb-1">Material Components</label>
                        <input
                          type="text"
                          value={formData.components.materialDescription}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            components: { ...prev.components, materialDescription: e.target.value }
                          }))}
                          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                          placeholder="e.g., a tiny ball of bat guano and sulfur"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">📜</span>
                    Description
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">Spell Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 h-24"
                        placeholder="Describe what the spell does..."
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">At Higher Levels (optional)</label>
                      <textarea
                        value={formData.higherLevel}
                        onChange={(e) => setFormData(prev => ({ ...prev, higherLevel: e.target.value }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 h-20"
                        placeholder="Describe what happens when cast at higher levels..."
                      />
                    </div>
                  </div>
                </div>

                {/* Combat Properties */}
                <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span className="text-red-600">⚔️</span>
                    Combat Properties
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-800 mb-1">Action Type</label>
                      <select
                        value={formData.actionType}
                        onChange={(e) => setFormData(prev => ({ ...prev, actionType: e.target.value as SpellActionType | '' }))}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                      >
                        {ACTION_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    {formData.actionType === 'save' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-800 mb-1">Saving Throw</label>
                        <select
                          value={formData.savingThrow}
                          onChange={(e) => setFormData(prev => ({ ...prev, savingThrow: e.target.value }))}
                          className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                        >
                          <option value="">Select saving throw...</option>
                          {SAVING_THROWS.map(save => (
                            <option key={save} value={save}>{save}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    
                    {(formData.actionType === 'attack' || formData.actionType === 'save') && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-800 mb-1">Damage (optional)</label>
                          <input
                            type="text"
                            value={formData.damage}
                            onChange={(e) => setFormData(prev => ({ ...prev, damage: e.target.value }))}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                            placeholder="e.g., 1d10, 3d6, 2d8+3"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-800 mb-1">Damage Type (optional)</label>
                          <select
                            value={formData.damageType}
                            onChange={(e) => setFormData(prev => ({ ...prev, damageType: e.target.value }))}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                          >
                            <option value="">Select damage type...</option>
                            {DAMAGE_TYPES.map(type => (
                              <option key={type} value={type.toLowerCase()}>{type}</option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Special Properties */}
                <div className="bg-white rounded-lg p-4 border border-purple-200 shadow-sm">
                  <h4 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
                    <span className="text-purple-600">⭐</span>
                    Special Properties
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="flex items-center text-sm font-medium text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.ritual}
                          onChange={(e) => setFormData(prev => ({ ...prev, ritual: e.target.checked }))}
                          className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Ritual
                      </label>
                      <label className="flex items-center text-sm font-medium text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.concentration}
                          onChange={(e) => setFormData(prev => ({ ...prev, concentration: e.target.checked }))}
                          className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Concentration
                      </label>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="flex items-center text-sm font-medium text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.isPrepared}
                          onChange={(e) => setFormData(prev => ({ ...prev, isPrepared: e.target.checked }))}
                          className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Prepared
                      </label>
                      <label className="flex items-center text-sm font-medium text-gray-800">
                        <input
                          type="checkbox"
                          checked={formData.isAlwaysPrepared}
                          onChange={(e) => setFormData(prev => ({ ...prev, isAlwaysPrepared: e.target.checked }))}
                          className="mr-2 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        Always Prepared
                      </label>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-800 mb-1">Source</label>
                    <input
                      type="text"
                      value={formData.source}
                      onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                      className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                      placeholder="e.g., PHB, XGE, TCE"
                    />
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-purple-200">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg font-semibold"
                  >
                    {editingId ? 'Update Spell' : 'Add Spell'}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-3 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </ModalPortal>

      {/* Spell Detail Modal */}
      <ModalPortal isOpen={!!viewingSpell}>
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setViewingSpell(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, margin: 0 }}
        >
          {viewingSpell && (
            <div className="bg-gradient-to-br from-white to-purple-50 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-purple-200 transform animate-in zoom-in-95 fade-in-0 duration-200">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-purple-800">{viewingSpell.name}</h3>
                    <p className="text-sm text-purple-600">
                      {viewingSpell.level === 0 ? 'Cantrip' : `Level ${viewingSpell.level}`} {viewingSpell.school}
                    </p>
                </div>
                <button
                  onClick={() => setViewingSpell(null)}
                  className="text-gray-600 hover:text-gray-800 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-800">Casting Time:</span>
                    <div className="text-purple-700">{viewingSpell.castingTime}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Range:</span>
                    <div className="text-purple-700">{viewingSpell.range}</div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Components:</span>
                    <div className="text-purple-700">
                      {[
                        viewingSpell.components.verbal && 'V',
                        viewingSpell.components.somatic && 'S',
                        viewingSpell.components.material && 'M'
                      ].filter(Boolean).join(', ') || 'None'}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-gray-800">Duration:</span>
                    <div className="text-purple-700">{viewingSpell.duration}</div>
                  </div>
                </div>

                {viewingSpell.components.material && viewingSpell.components.materialDescription && (
                  <div className="text-sm">
                    <span className="font-medium text-gray-800">Materials:</span>
                    <div className="text-purple-700">{viewingSpell.components.materialDescription}</div>
                  </div>
                )}

                <div>
                  <span className="font-medium text-gray-800">Description:</span>
                  <div className="text-gray-700 mt-1 whitespace-pre-wrap">{viewingSpell.description}</div>
                </div>

                {viewingSpell.higherLevel && (
                  <div>
                    <span className="font-medium text-gray-800">At Higher Levels:</span>
                    <div className="text-gray-700 mt-1 whitespace-pre-wrap">{viewingSpell.higherLevel}</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {viewingSpell.ritual && (
                    <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">Ritual</span>
                  )}
                  {viewingSpell.concentration && (
                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Concentration</span>
                  )}
                  {viewingSpell.isPrepared && (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">Prepared</span>
                  )}
                  {viewingSpell.isAlwaysPrepared && (
                    <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded">Always Prepared</span>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-purple-200 flex gap-3">
                <button
                  onClick={() => {
                    setViewingSpell(null);
                    handleEdit(viewingSpell);
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                >
                  Edit Spell
                </button>
                <button
                  onClick={() => setViewingSpell(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      </ModalPortal>
    </div>
  );
}; 