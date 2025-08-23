'use client';

import React, { useState } from 'react';
import { TrackableTrait } from '@/types/character';
import { calculateTraitMaxUses, getProficiencyBonus } from '@/utils/calculations';
import { RotateCcw, Plus, Edit3, Trash2, Zap } from 'lucide-react';

interface TraitTrackerProps {
  traits: TrackableTrait[];
  characterLevel: number;
  onAddTrait: (trait: Omit<TrackableTrait, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTrait: (id: string, updates: Partial<TrackableTrait>) => void;
  onDeleteTrait: (id: string) => void;
  onUseTrait: (id: string) => void;
  onResetTraits: (restType: 'short' | 'long') => void;
  className?: string;
}

export default function TraitTracker({
  traits,
  characterLevel,
  onAddTrait,
  onUpdateTrait,
  onDeleteTrait,
  onUseTrait,
  onResetTraits,
  className = ''
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
    proficiencyMultiplier: 1
  });
  const [editTrait, setEditTrait] = useState<Partial<TrackableTrait>>({});

  const handleAdd = () => {
    if (newTrait.name.trim()) {
      onAddTrait({
        name: newTrait.name.trim(),
        description: newTrait.description.trim() || undefined,
        maxUses: newTrait.maxUses,
        usedUses: 0,
        restType: newTrait.restType,
        source: newTrait.source.trim() || undefined,
        scaleWithProficiency: newTrait.scaleWithProficiency,
        proficiencyMultiplier: newTrait.scaleWithProficiency ? newTrait.proficiencyMultiplier : undefined
      });
      setNewTrait({
        name: '',
        description: '',
        maxUses: 1,
        restType: 'long',
        source: '',
        scaleWithProficiency: false,
        proficiencyMultiplier: 1
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
      proficiencyMultiplier: trait.proficiencyMultiplier || 1
    });
  };

  const handleUpdate = () => {
    if (editingId && editTrait.name?.trim()) {
      onUpdateTrait(editingId, {
        name: editTrait.name.trim(),
        description: editTrait.description?.trim() || undefined,
        maxUses: editTrait.maxUses,
        restType: editTrait.restType,
        source: editTrait.source?.trim() || undefined,
        scaleWithProficiency: editTrait.scaleWithProficiency,
        proficiencyMultiplier: editTrait.scaleWithProficiency ? editTrait.proficiencyMultiplier : undefined
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
      proficiencyMultiplier: 1
    });
  };

  // Safety guard to ensure traits is always an array
  const safeTraits = Array.isArray(traits) ? traits : [];

  const renderUsageCheckboxes = (trait: TrackableTrait) => {
    const effectiveMaxUses = calculateTraitMaxUses(trait, characterLevel);
    return (
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: effectiveMaxUses }, (_, index) => (
          <button
            key={index}
            onClick={() => {
              const newUsed = index < trait.usedUses ? trait.usedUses - 1 : index + 1;
              onUpdateTrait(trait.id, {
                usedUses: Math.max(0, Math.min(newUsed, effectiveMaxUses))
              });
            }}
            className={`w-4 h-4 border-2 rounded transition-colors ${
              index < trait.usedUses
                ? 'bg-red-500 border-red-500' // Used
                : 'bg-white border-gray-400 hover:border-gray-600' // Available
            }`}
            title={`Use ${index + 1} - ${index < trait.usedUses ? 'Used' : 'Available'}`}
          />
        ))}
      </div>
    );
  };

  const shortRestTraits = safeTraits.filter(trait => trait.restType === 'short');
  const longRestTraits = safeTraits.filter(trait => trait.restType === 'long');

  if (safeTraits.length === 0 && !isAdding) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-indigo-800">Special Abilities</h3>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm transition-colors"
          >
            <Plus size={14} />
            <span>Add Ability</span>
          </button>
        </div>
        <div className="text-center py-6 text-gray-500">
          <Zap className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="font-medium">No special abilities yet</p>
          <p className="text-sm mt-1">Add traits like racial abilities, feat powers, or class features with limited uses.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-indigo-800">Special Abilities</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAdding(true)}
            disabled={isAdding || editingId !== null}
            className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            <span>Add</span>
          </button>
          {shortRestTraits.length > 0 && (
            <button
              onClick={() => onResetTraits('short')}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              title="Reset short rest abilities"
            >
              <RotateCcw size={14} />
              <span>Short Rest</span>
            </button>
          )}
          {longRestTraits.length > 0 && (
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
      </div>

      {/* Add New Trait Form */}
      {isAdding && (
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
                         {/* Proficiency Scaling Toggle */}
             <div className="space-y-4">
               <div className="flex items-center space-x-3">
                 <input
                   type="checkbox"
                   id="scaleWithProficiency"
                   checked={newTrait.scaleWithProficiency}
                   onChange={(e) => setNewTrait({ ...newTrait, scaleWithProficiency: e.target.checked })}
                   className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                 />
                 <label htmlFor="scaleWithProficiency" className="text-sm font-bold text-indigo-800">
                   Scale with Proficiency Bonus
                 </label>
               </div>
               
               <div className="space-y-4">
                 {newTrait.scaleWithProficiency ? (
                   <>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <label className="block text-sm font-bold text-indigo-800 mb-2">Multiplier</label>
                         <input
                           type="number"
                           min="1"
                           max="5"
                           value={newTrait.proficiencyMultiplier}
                           onChange={(e) => setNewTrait({ ...newTrait, proficiencyMultiplier: parseInt(e.target.value) || 1 })}
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
                     <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                       <p className="text-sm text-indigo-700 font-medium">
                         Current Uses: {Math.max(1, getProficiencyBonus(characterLevel) * newTrait.proficiencyMultiplier)}
                       </p>
                       <p className="text-xs text-indigo-600 mt-1">
                         Proficiency Bonus ({getProficiencyBonus(characterLevel)}) × Multiplier ({newTrait.proficiencyMultiplier})
                       </p>
                     </div>
                   </>
                 ) : (
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
                 )}
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
      <div className="space-y-3">
        {safeTraits.map((trait) => (
          <div key={trait.id} className="border border-gray-200 rounded-lg p-3">
            {editingId === trait.id ? (
                             // Edit Mode
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
                 {/* Proficiency Scaling Toggle */}
                 <div className="space-y-4">
                   <div className="flex items-center space-x-3">
                     <input
                       type="checkbox"
                       id="editScaleWithProficiency"
                       checked={editTrait.scaleWithProficiency || false}
                       onChange={(e) => setEditTrait({ ...editTrait, scaleWithProficiency: e.target.checked })}
                       className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                     />
                     <label htmlFor="editScaleWithProficiency" className="text-sm font-bold text-indigo-800">
                       Scale with Proficiency Bonus
                     </label>
                   </div>
                   
                   <div className="space-y-4">
                     {editTrait.scaleWithProficiency ? (
                       <>
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="block text-sm font-bold text-indigo-800 mb-2">Multiplier</label>
                             <input
                               type="number"
                               min="1"
                               max="5"
                               value={editTrait.proficiencyMultiplier || 1}
                               onChange={(e) => setEditTrait({ ...editTrait, proficiencyMultiplier: parseInt(e.target.value) || 1 })}
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
                         <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                           <p className="text-sm text-indigo-700 font-medium">
                             Current Uses: {Math.max(1, getProficiencyBonus(characterLevel) * (editTrait.proficiencyMultiplier || 1))}
                           </p>
                           <p className="text-xs text-indigo-600 mt-1">
                             Proficiency Bonus ({getProficiencyBonus(characterLevel)}) × Multiplier ({editTrait.proficiencyMultiplier || 1})
                           </p>
                         </div>
                       </>
                     ) : (
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
                     )}
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
            ) : (
              // Display Mode
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900 truncate">{trait.name}</h4>
                      {trait.source && (
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                          {trait.source}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${
                        trait.restType === 'short' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {trait.restType === 'short' ? 'Short Rest' : 'Long Rest'}
                      </span>
                    </div>
                    {trait.description && (
                      <p className="text-sm text-gray-600 mt-1">{trait.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={() => handleEdit(trait)}
                      disabled={isAdding}
                      className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-colors disabled:opacity-50"
                      title="Edit ability"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => onDeleteTrait(trait.id)}
                      disabled={isAdding}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-50"
                      title="Delete ability"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-700">
                      Uses: {calculateTraitMaxUses(trait, characterLevel) - trait.usedUses}/{calculateTraitMaxUses(trait, characterLevel)}
                      {trait.scaleWithProficiency && (
                        <span className="text-xs text-indigo-600 ml-1">(Proficiency)</span>
                      )}
                    </span>
                    {renderUsageCheckboxes(trait)}
                  </div>
                  <button
                    onClick={() => onUseTrait(trait.id)}
                    disabled={trait.usedUses >= calculateTraitMaxUses(trait, characterLevel)}
                    className="text-sm px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Use ability"
                  >
                    Use
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 