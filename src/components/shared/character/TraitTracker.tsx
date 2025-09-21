'use client';

import React, { useState } from 'react';
import { TrackableTrait } from '@/types/character';
import {
  calculateTraitMaxUses,
  getProficiencyBonus,
} from '@/utils/calculations';
import { RotateCcw, Plus, Edit3, Trash2, Zap } from 'lucide-react';

interface TraitTrackerProps {
  traits: TrackableTrait[];
  characterLevel?: number;
  onAddTrait?: (
    trait: Omit<TrackableTrait, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
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
  characterLevel = 1,
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
  className = '',
}: TraitTrackerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTrait, setNewTrait] = useState({
    name: '',
    description: '',
    maxUses: 1,
    restType: 'long' as 'short' | 'long',
    source: '',
    scaleWithProficiency: false,
    proficiencyMultiplier: 1,
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
        source: newTrait.source.trim() || undefined,
        scaleWithProficiency: newTrait.scaleWithProficiency,
        proficiencyMultiplier: newTrait.scaleWithProficiency
          ? newTrait.proficiencyMultiplier
          : undefined,
      });
      setNewTrait({
        name: '',
        description: '',
        maxUses: 1,
        restType: 'long',
        source: '',
        scaleWithProficiency: false,
        proficiencyMultiplier: 1,
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
      source: trait.source || '',
      scaleWithProficiency: trait.scaleWithProficiency || false,
      proficiencyMultiplier: trait.proficiencyMultiplier || 1,
    });
  };

  const handleUpdate = () => {
    if (editingId && editTrait.name?.trim() && onUpdateTrait) {
      onUpdateTrait(editingId, {
        name: editTrait.name.trim(),
        description: editTrait.description?.trim() || undefined,
        maxUses: editTrait.maxUses,
        restType: editTrait.restType,
        source: editTrait.source?.trim() || undefined,
        scaleWithProficiency: editTrait.scaleWithProficiency,
        proficiencyMultiplier: editTrait.scaleWithProficiency
          ? editTrait.proficiencyMultiplier
          : undefined,
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
      source: '',
      scaleWithProficiency: false,
      proficiencyMultiplier: 1,
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
    const effectiveMaxUses = calculateTraitMaxUses(trait, characterLevel);

    return (
      <div className={`flex flex-wrap ${gap}`}>
        {Array.from({ length: effectiveMaxUses }, (_, index) => (
          <button
            key={index}
            onClick={() => {
              if (readonly || !onUpdateTrait) return;
              const newUsed =
                index < trait.usedUses ? trait.usedUses - 1 : index + 1;
              onUpdateTrait(trait.id, {
                usedUses: Math.max(0, Math.min(newUsed, effectiveMaxUses)),
              });
            }}
            disabled={readonly || !onUpdateTrait}
            className={`${size} rounded border-2 transition-colors ${
              index < trait.usedUses
                ? 'border-red-500 bg-red-500' // Used
                : readonly
                  ? 'border-gray-300 bg-white'
                  : 'border-gray-400 bg-white hover:border-gray-600' // Available
            } ${readonly ? '' : 'cursor-pointer'}`}
            title={`Use ${index + 1} - ${index < trait.usedUses ? 'Used' : 'Available'}`}
          />
        ))}
      </div>
    );
  };

  const shortRestTraits = displayTraits.filter(
    trait => trait.restType === 'short'
  );
  const longRestTraits = displayTraits.filter(
    trait => trait.restType === 'long'
  );

  const containerClasses = compact
    ? `bg-white rounded-lg border border-gray-200 p-3 ${className}`
    : `bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`;

  if (displayTraits.length === 0 && !isAdding) {
    return (
      <div className={containerClasses}>
        <div className="mb-4 flex items-center justify-between">
          <h3
            className={`flex items-center gap-2 font-semibold text-indigo-800 ${compact ? 'text-base' : 'text-lg'}`}
          >
            <Zap size={compact ? 16 : 20} />
            {compact ? 'Abilities' : 'Special Abilities'}
          </h3>
          {!readonly && !hideAddButton && onAddTrait && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center space-x-1 rounded-md bg-indigo-600 px-3 py-1 text-sm text-white transition-colors hover:bg-indigo-700"
            >
              <Plus size={14} />
              <span>Add Ability</span>
            </button>
          )}
        </div>
        {!compact && (
          <div className="py-6 text-center text-gray-500">
            <Zap className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p className="font-medium">No special abilities yet</p>
            <p className="mt-1 text-sm">
              Add traits like racial abilities, feat powers, or class features
              with limited uses.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h3
          className={`flex items-center gap-2 font-semibold text-indigo-800 ${compact ? 'text-base' : 'text-lg'}`}
        >
          <Zap size={compact ? 16 : 20} />
          {compact ? 'Abilities' : 'Special Abilities'}
        </h3>
        {!readonly && !hideControls && (
          <div className="flex items-center space-x-2">
            {!hideAddButton && onAddTrait && (
              <button
                onClick={() => setIsAdding(true)}
                disabled={isAdding || editingId !== null}
                className="flex items-center space-x-1 rounded-md bg-indigo-600 px-3 py-1 text-sm text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            )}
            {!hideResetButtons &&
              onResetTraits &&
              shortRestTraits.length > 0 && (
                <button
                  onClick={() => onResetTraits('short')}
                  className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
                  title="Reset short rest abilities"
                >
                  <RotateCcw size={14} />
                  <span>Short Rest</span>
                </button>
              )}
            {!hideResetButtons &&
              onResetTraits &&
              longRestTraits.length > 0 && (
                <button
                  onClick={() => onResetTraits('long')}
                  className="flex items-center space-x-1 text-sm text-indigo-600 hover:text-indigo-800"
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
        <div className="rounded-xl border-2 border-indigo-300 bg-gradient-to-br from-indigo-50 to-blue-50 p-6 shadow-lg">
          <h4 className="mb-4 flex items-center gap-2 text-lg font-bold text-indigo-900">
            <Zap className="h-5 w-5 text-indigo-600" />
            Add New Special Ability
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold text-indigo-800">
                  Ability Name
                </label>
                <input
                  type="text"
                  value={newTrait.name}
                  onChange={e =>
                    setNewTrait({ ...newTrait, name: e.target.value })
                  }
                  placeholder="e.g., Breath Weapon"
                  className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-indigo-800">
                  Source Type
                </label>
                <input
                  type="text"
                  value={newTrait.source}
                  onChange={e =>
                    setNewTrait({ ...newTrait, source: e.target.value })
                  }
                  placeholder="e.g., Racial, Feat, Class Feature"
                  className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-indigo-800">
                Description
              </label>
              <textarea
                value={newTrait.description}
                onChange={e =>
                  setNewTrait({ ...newTrait, description: e.target.value })
                }
                placeholder="Brief description of what this ability does..."
                rows={3}
                className="w-full resize-none rounded-lg border-2 border-gray-300 bg-white p-3 text-base text-gray-900 placeholder-gray-400 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            {/* Proficiency Scaling Toggle */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="scaleWithProficiency"
                  checked={newTrait.scaleWithProficiency}
                  onChange={e =>
                    setNewTrait({
                      ...newTrait,
                      scaleWithProficiency: e.target.checked,
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <label
                  htmlFor="scaleWithProficiency"
                  className="text-sm font-bold text-indigo-800"
                >
                  Scale with Proficiency Bonus
                </label>
              </div>

              <div className="space-y-4">
                {newTrait.scaleWithProficiency ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-2 block text-sm font-bold text-indigo-800">
                          Multiplier
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="5"
                          value={newTrait.proficiencyMultiplier}
                          onChange={e =>
                            setNewTrait({
                              ...newTrait,
                              proficiencyMultiplier:
                                parseInt(e.target.value) || 1,
                            })
                          }
                          className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-bold text-indigo-800">
                          Recharges On
                        </label>
                        <select
                          value={newTrait.restType}
                          onChange={e =>
                            setNewTrait({
                              ...newTrait,
                              restType: e.target.value as 'short' | 'long',
                            })
                          }
                          className="w-full cursor-pointer rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="short">Short Rest</option>
                          <option value="long">Long Rest</option>
                        </select>
                      </div>
                    </div>
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                      <p className="text-sm font-medium text-indigo-700">
                        Current Uses:{' '}
                        {Math.max(
                          1,
                          getProficiencyBonus(characterLevel) *
                            newTrait.proficiencyMultiplier
                        )}
                      </p>
                      <p className="mt-1 text-xs text-indigo-600">
                        Proficiency Bonus ({getProficiencyBonus(characterLevel)}
                        ) × Multiplier ({newTrait.proficiencyMultiplier})
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-indigo-800">
                        Maximum Uses
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newTrait.maxUses}
                        onChange={e =>
                          setNewTrait({
                            ...newTrait,
                            maxUses: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-indigo-800">
                        Recharges On
                      </label>
                      <select
                        value={newTrait.restType}
                        onChange={e =>
                          setNewTrait({
                            ...newTrait,
                            restType: e.target.value as 'short' | 'long',
                          })
                        }
                        className="w-full cursor-pointer rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="short">Short Rest</option>
                        <option value="long">Long Rest</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={handleCancel}
                className="rounded-lg border-2 border-gray-300 px-4 py-2 font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newTrait.name.trim()}
                className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add Ability
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Traits List */}
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {displayTraits.map(trait => (
          <div
            key={trait.id}
            className={`rounded-lg border border-gray-200 ${compact ? 'p-2' : 'p-3'}`}
          >
            {!readonly && editingId === trait.id && onUpdateTrait ? (
              // Edit Mode (only in non-compact mode)
              !compact && (
                <div className="space-y-4 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-indigo-800">
                        Name
                      </label>
                      <input
                        type="text"
                        value={editTrait.name || ''}
                        onChange={e =>
                          setEditTrait({ ...editTrait, name: e.target.value })
                        }
                        className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-indigo-800">
                        Source
                      </label>
                      <input
                        type="text"
                        value={editTrait.source || ''}
                        onChange={e =>
                          setEditTrait({ ...editTrait, source: e.target.value })
                        }
                        className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-indigo-800">
                      Description
                    </label>
                    <textarea
                      value={editTrait.description || ''}
                      onChange={e =>
                        setEditTrait({
                          ...editTrait,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full resize-none rounded-lg border-2 border-gray-300 bg-white p-3 text-base text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Proficiency Scaling Toggle */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="editScaleWithProficiency"
                        checked={editTrait.scaleWithProficiency || false}
                        onChange={e =>
                          setEditTrait({
                            ...editTrait,
                            scaleWithProficiency: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300 bg-gray-100 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                      <label
                        htmlFor="editScaleWithProficiency"
                        className="text-sm font-bold text-indigo-800"
                      >
                        Scale with Proficiency Bonus
                      </label>
                    </div>

                    <div className="space-y-4">
                      {editTrait.scaleWithProficiency ? (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="mb-2 block text-sm font-bold text-indigo-800">
                                Multiplier
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="5"
                                value={editTrait.proficiencyMultiplier || 1}
                                onChange={e =>
                                  setEditTrait({
                                    ...editTrait,
                                    proficiencyMultiplier:
                                      parseInt(e.target.value) || 1,
                                  })
                                }
                                className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-bold text-indigo-800">
                                Recharges On
                              </label>
                              <select
                                value={editTrait.restType || 'long'}
                                onChange={e =>
                                  setEditTrait({
                                    ...editTrait,
                                    restType: e.target.value as
                                      | 'short'
                                      | 'long',
                                  })
                                }
                                className="w-full cursor-pointer rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="short">Short Rest</option>
                                <option value="long">Long Rest</option>
                              </select>
                            </div>
                          </div>
                          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                            <p className="text-sm font-medium text-indigo-700">
                              Current Uses:{' '}
                              {Math.max(
                                1,
                                getProficiencyBonus(characterLevel) *
                                  (editTrait.proficiencyMultiplier || 1)
                              )}
                            </p>
                            <p className="mt-1 text-xs text-indigo-600">
                              Proficiency Bonus (
                              {getProficiencyBonus(characterLevel)}) ×
                              Multiplier ({editTrait.proficiencyMultiplier || 1}
                              )
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-2 block text-sm font-bold text-indigo-800">
                              Max Uses
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={editTrait.maxUses || 1}
                              onChange={e =>
                                setEditTrait({
                                  ...editTrait,
                                  maxUses: parseInt(e.target.value) || 1,
                                })
                              }
                              className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-bold text-indigo-800">
                              Recharges On
                            </label>
                            <select
                              value={editTrait.restType || 'long'}
                              onChange={e =>
                                setEditTrait({
                                  ...editTrait,
                                  restType: e.target.value as 'short' | 'long',
                                })
                              }
                              className="w-full cursor-pointer rounded-lg border-2 border-gray-300 bg-white p-3 text-base font-medium text-gray-900 shadow-sm transition-all hover:border-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="short">Short Rest</option>
                              <option value="long">Long Rest</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={handleCancel}
                      className="rounded-lg border-2 border-gray-300 px-4 py-2 font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpdate}
                      disabled={!editTrait.name?.trim()}
                      className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )
            ) : (
              // Display Mode
              <div>
                <div
                  className={`mb-2 flex items-start justify-between ${compact ? 'mb-1' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h4
                        className={`truncate font-medium text-gray-900 ${compact ? 'text-sm' : ''}`}
                      >
                        {trait.name}
                      </h4>
                      {trait.source && (
                        <span
                          className={`rounded bg-gray-100 px-2 py-1 text-gray-600 ${compact ? 'text-xs' : 'text-xs'}`}
                        >
                          {trait.source}
                        </span>
                      )}
                      <span
                        className={`rounded px-2 py-1 ${compact ? 'text-xs' : 'text-xs'} ${
                          trait.restType === 'short'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {trait.restType === 'short'
                          ? 'Short Rest'
                          : 'Long Rest'}
                      </span>
                    </div>
                    {trait.description && !compact && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                        {trait.description}
                      </p>
                    )}
                  </div>
                  {!readonly && !hideControls && (
                    <div className="ml-2 flex items-center space-x-1">
                      {!compact && onUpdateTrait && (
                        <button
                          onClick={() => handleEdit(trait)}
                          disabled={isAdding}
                          className="rounded p-1 text-indigo-600 transition-colors hover:bg-indigo-100 disabled:opacity-50"
                          title="Edit ability"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      {onDeleteTrait && (
                        <button
                          onClick={() => onDeleteTrait(trait.id)}
                          disabled={isAdding}
                          className="rounded p-1 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
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
                    <span
                      className={`font-medium text-gray-700 ${compact ? 'text-xs' : 'text-sm'}`}
                    >
                      Uses:{' '}
                      {calculateTraitMaxUses(trait, characterLevel) -
                        trait.usedUses}
                      /{calculateTraitMaxUses(trait, characterLevel)}
                      {trait.scaleWithProficiency && (
                        <span className="ml-1 text-xs text-indigo-600">
                          (Proficiency)
                        </span>
                      )}
                    </span>
                    {renderUsageCheckboxes(trait)}
                  </div>
                  {!readonly && onUseTrait && (
                    <button
                      onClick={() => onUseTrait(trait.id)}
                      disabled={
                        trait.usedUses >=
                        calculateTraitMaxUses(trait, characterLevel)
                      }
                      className={`rounded bg-indigo-600 px-2 py-1 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ${compact ? 'text-xs' : 'text-sm'}`}
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
