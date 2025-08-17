'use client';

import React, { useState } from 'react';
import { TrackableTrait } from '@/types/character';
import { RotateCcw, Plus, Edit3, Trash2, Zap } from 'lucide-react';

interface TraitTrackerProps {
  traits: TrackableTrait[];
  onAddTrait?: (trait: Omit<TrackableTrait, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTrait?: (id: string, updates: Partial<TrackableTrait>) => void;
  onDeleteTrait?: (id: string) => void;
  onUseTrait?: (id: string) => void;
  onResetTraits?: (restType: 'short' | 'long') => void;
  
  // Display options
  readonly?: boolean;
  compact?: boolean;
  hideControls?: boolean;
  hideAddButton?: boolean;
  hideResetButtons?: boolean;
  showOnlyUsed?: boolean;
  maxTraitsToShow?: number;
  
  className?: string;
}

export function TraitTracker({
  traits,
  onAddTrait,
  onUpdateTrait,
  onDeleteTrait,
  onUseTrait,
  onResetTraits,
  readonly = false,
  compact = false,
  hideControls = false,
  hideAddButton = false,
  hideResetButtons = false,
  showOnlyUsed = false,
  maxTraitsToShow,
  className = ''
}: TraitTrackerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTrait, setNewTrait] = useState({
    name: '',
    description: '',
    maxUses: 1,
    restType: 'long' as 'short' | 'long',
    source: ''
  });
  const [editTrait, setEditTrait] = useState<Partial<TrackableTrait>>({});

  const handleAdd = () => {
    if (newTrait.name.trim() && onAddTrait) {
      onAddTrait({
        name: newTrait.name.trim(),
        description: newTrait.description.trim() || undefined,
        maxUses: newTrait.maxUses,
        usedUses: 0,
        restType: newTrait.restType,
        source: newTrait.source.trim() || undefined
      });
      setNewTrait({
        name: '',
        description: '',
        maxUses: 1,
        restType: 'long',
        source: ''
      });
      setIsAdding(false);
    }
  };

  const handleEdit = (trait: TrackableTrait) => {
    setEditingId(trait.id);
    setEditTrait({
      name: trait.name,
      description: trait.description || '',
      maxUses: trait.maxUses,
      restType: trait.restType,
      source: trait.source || ''
    });
  };

  const handleUpdate = () => {
    if (editingId && editTrait.name?.trim() && onUpdateTrait) {
      onUpdateTrait(editingId, {
        name: editTrait.name.trim(),
        description: editTrait.description?.trim() || undefined,
        maxUses: editTrait.maxUses,
        restType: editTrait.restType,
        source: editTrait.source?.trim() || undefined
      });
      setEditingId(null);
      setEditTrait({});
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditTrait({});
    setIsAdding(false);
    setNewTrait({
      name: '',
      description: '',
      maxUses: 1,
      restType: 'long',
      source: ''
    });
  };

  // Safety guard to ensure traits is always an array
  const safeTraits = Array.isArray(traits) ? traits : [];
  
  // Filter traits based on display options
  let displayTraits = safeTraits;
  if (showOnlyUsed) {
    displayTraits = displayTraits.filter(trait => trait.usedUses > 0);
  }
  if (maxTraitsToShow) {
    displayTraits = displayTraits.slice(0, maxTraitsToShow);
  }

  const renderUsageCheckboxes = (trait: TrackableTrait) => {
    const size = compact ? 'w-3 h-3' : 'w-4 h-4';
    const gap = compact ? 'gap-0.5' : 'gap-1';
    
    return (
      <div className={`flex flex-wrap ${gap}`}>
        {Array.from({ length: trait.maxUses }, (_, index) => (
          <button
            key={index}
            onClick={() => {
              if (readonly || !onUpdateTrait) return;
              const newUsed = index < trait.usedUses ? trait.usedUses - 1 : index + 1;
              onUpdateTrait(trait.id, {
                usedUses: Math.max(0, Math.min(newUsed, trait.maxUses))
              });
            }}
            disabled={readonly || !onUpdateTrait}
            className={`${size} border-2 rounded transition-colors ${
              index < trait.usedUses
                ? 'bg-red-500 border-red-500' // Used
                : readonly 
                  ? 'bg-white border-gray-300'
                  : 'bg-white border-gray-400 hover:border-gray-600' // Available
            } ${readonly ? '' : 'cursor-pointer'}`}
            title={`Use ${index + 1} - ${index < trait.usedUses ? 'Used' : 'Available'}`}
          />
        ))}
      </div>
    );
  };

  const shortRestTraits = displayTraits.filter(trait => trait.restType === 'short');
  const longRestTraits = displayTraits.filter(trait => trait.restType === 'long');

  const containerClasses = compact
    ? `bg-white rounded-lg border border-gray-200 p-3 ${className}`
    : `bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`;

  if (displayTraits.length === 0 && !isAdding) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-semibold text-indigo-800 flex items-center gap-2 ${compact ? 'text-base' : 'text-lg'}`}>
            <Zap size={compact ? 16 : 20} />
            {compact ? 'Abilities' : 'Special Abilities'}
          </h3>
          {!readonly && !hideAddButton && onAddTrait && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm transition-colors"
            >
              <Plus size={14} />
              <span>Add Ability</span>
            </button>
          )}
        </div>
        {!compact && (
          <div className="text-center py-6 text-gray-500">
            <Zap className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="font-medium">No special abilities yet</p>
            <p className="text-sm mt-1">Add traits like racial abilities, feat powers, or class features with limited uses.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-indigo-800 flex items-center gap-2 ${compact ? 'text-base' : 'text-lg'}`}>
          <Zap size={compact ? 16 : 20} />
          {compact ? 'Abilities' : 'Special Abilities'}
        </h3>
        {!readonly && !hideControls && (
          <div className="flex items-center space-x-2">
            {!hideAddButton && onAddTrait && (
              <button
                onClick={() => setIsAdding(true)}
                disabled={isAdding || editingId !== null}
                className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            )}
            {!hideResetButtons && onResetTraits && shortRestTraits.length > 0 && (
              <button
                onClick={() => onResetTraits('short')}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                title="Reset short rest abilities"
              >
                <RotateCcw size={14} />
                <span>Short Rest</span>
              </button>
            )}
            {!hideResetButtons && onResetTraits && longRestTraits.length > 0 && (
              <button
                onClick={() => onResetTraits('long')}
                className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                title="Reset all abilities"
              >
                <RotateCcw size={14} />
                <span>Long Rest</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add New Trait Form */}
      {!readonly && isAdding && onAddTrait && !compact && (
        <div className="border-2 border-indigo-300 rounded-xl p-6 bg-gradient-to-br from-indigo-50 to-blue-50 shadow-lg">
          <h4 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-600" />
            Add New Special Ability
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-2">Ability Name</label>
                <input
                  type="text"
                  value={newTrait.name}
                  onChange={(e) => setNewTrait({ ...newTrait, name: e.target.value })}
                  placeholder="e.g., Breath Weapon"
                  className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400 shadow-sm transition-all hover:border-gray-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-2">Source Type</label>
                <input
                  type="text"
                  value={newTrait.source}
                  onChange={(e) => setNewTrait({ ...newTrait, source: e.target.value })}
                  placeholder="e.g., Racial, Feat, Class Feature"
                  className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400 shadow-sm transition-all hover:border-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-indigo-800 mb-2">Description</label>
              <textarea
                value={newTrait.description}
                onChange={(e) => setNewTrait({ ...newTrait, description: e.target.value })}
                placeholder="Brief description of what this ability does..."
                rows={3}
                className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 placeholder-gray-400 shadow-sm transition-all resize-none hover:border-gray-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-2">Maximum Uses</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newTrait.maxUses}
                  onChange={(e) => setNewTrait({ ...newTrait, maxUses: parseInt(e.target.value) || 1 })}
                  className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 shadow-sm transition-all hover:border-gray-400 font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-2">Recharges On</label>
                <select
                  value={newTrait.restType}
                  onChange={(e) => setNewTrait({ ...newTrait, restType: e.target.value as 'short' | 'long' })}
                  className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 shadow-sm transition-all cursor-pointer hover:border-gray-400 font-medium"
                >
                  <option value="short">Short Rest</option>
                  <option value="long">Long Rest</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newTrait.name.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
              >
                Add Ability
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Traits List */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {displayTraits.map((trait) => (
          <div key={trait.id} className={`border border-gray-200 rounded-lg ${compact ? 'p-2' : 'p-3'}`}>
            {!readonly && editingId === trait.id && onUpdateTrait ? (
              // Edit Mode (only in non-compact mode)
              !compact && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-indigo-800 mb-2">Name</label>
                      <input
                        type="text"
                        value={editTrait.name || ''}
                        onChange={(e) => setEditTrait({ ...editTrait, name: e.target.value })}
                        className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 shadow-sm transition-all hover:border-gray-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-indigo-800 mb-2">Source</label>
                      <input
                        type="text"
                        value={editTrait.source || ''}
                        onChange={(e) => setEditTrait({ ...editTrait, source: e.target.value })}
                        className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 shadow-sm transition-all hover:border-gray-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-indigo-800 mb-2">Description</label>
                    <textarea
                      value={editTrait.description || ''}
                      onChange={(e) => setEditTrait({ ...editTrait, description: e.target.value })}
                      rows={3}
                      className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 shadow-sm transition-all resize-none hover:border-gray-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-indigo-800 mb-2">Max Uses</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={editTrait.maxUses || 1}
                        onChange={(e) => setEditTrait({ ...editTrait, maxUses: parseInt(e.target.value) || 1 })}
                        className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 shadow-sm transition-all hover:border-gray-400 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-indigo-800 mb-2">Recharges On</label>
                      <select
                        value={editTrait.restType || 'long'}
                        onChange={(e) => setEditTrait({ ...editTrait, restType: e.target.value as 'short' | 'long' })}
                        className="w-full text-base p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 shadow-sm transition-all cursor-pointer hover:border-gray-400 font-medium"
                      >
                        <option value="short">Short Rest</option>
                        <option value="long">Long Rest</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdate}
                      disabled={!editTrait.name?.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md hover:shadow-lg"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )
            ) : (
              // Display Mode
              <div>
                <div className={`flex items-start justify-between mb-2 ${compact ? 'mb-1' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className={`font-medium text-gray-900 truncate ${compact ? 'text-sm' : ''}`}>
                        {trait.name}
                      </h4>
                      {trait.source && (
                        <span className={`px-2 py-1 bg-gray-100 text-gray-600 rounded ${compact ? 'text-xs' : 'text-xs'}`}>
                          {trait.source}
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded ${compact ? 'text-xs' : 'text-xs'} ${
                        trait.restType === 'short' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {trait.restType === 'short' ? 'Short Rest' : 'Long Rest'}
                      </span>
                    </div>
                    {trait.description && !compact && (
                      <p className="text-sm text-gray-600 mt-1">{trait.description}</p>
                    )}
                  </div>
                  {!readonly && !hideControls && (
                    <div className="flex items-center space-x-1 ml-2">
                      {!compact && onUpdateTrait && (
                        <button
                          onClick={() => handleEdit(trait)}
                          disabled={isAdding}
                          className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors disabled:opacity-50"
                          title="Edit ability"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      {onDeleteTrait && (
                        <button
                          onClick={() => onDeleteTrait(trait.id)}
                          disabled={isAdding}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                          title="Delete ability"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}>
                      Uses: {trait.maxUses - trait.usedUses}/{trait.maxUses}
                    </span>
                    {renderUsageCheckboxes(trait)}
                  </div>
                  {!readonly && onUseTrait && (
                    <button
                      onClick={() => onUseTrait(trait.id)}
                      disabled={trait.usedUses >= trait.maxUses}
                      className={`px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
                      title="Use ability"
                    >
                      Use
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
