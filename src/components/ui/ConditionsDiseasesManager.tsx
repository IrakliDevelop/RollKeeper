'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus, X, AlertTriangle, Shield, Eye, EyeOff, Settings, Search, Trash2 } from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { 
  loadAllConditions, 
  loadAllDiseases, 
  getExhaustionByVariant 
} from '@/utils/conditionsDiseasesLoader';
import { 
  ProcessedCondition, 
  ProcessedDisease, 
  ActiveCondition, 
  ActiveDisease,
  ExhaustionVariant 
} from '@/types/character';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import ConditionDetailsModal from './ConditionDetailsModal';

export default function ConditionsDiseasesManager() {
  const {
    character,
    addCondition,
    updateCondition,
    removeCondition,
    addDisease,
    updateDisease,
    removeDisease,
    setExhaustionVariant,
    clearAllConditions,
    clearAllDiseases
  } = useCharacterStore();

  const [availableConditions, setAvailableConditions] = useState<ProcessedCondition[]>([]);
  const [availableDiseases, setAvailableDiseases] = useState<ProcessedDisease[]>([]);
  const [conditionSearch, setConditionSearch] = useState('');
  const [diseaseSearch, setDiseaseSearch] = useState('');
  const [showConditionDetails, setShowConditionDetails] = useState<string | null>(null);
  const [showDiseaseDetails, setShowDiseaseDetails] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCondition, setSelectedCondition] = useState<ActiveCondition | null>(null);
  const [selectedDisease, setSelectedDisease] = useState<ActiveDisease | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load conditions and diseases data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [conditions, diseases] = await Promise.all([
          loadAllConditions(),
          loadAllDiseases()
        ]);
        setAvailableConditions(conditions);
        setAvailableDiseases(diseases);
      } catch (error) {
        console.error('Failed to load conditions/diseases:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const { activeConditions, activeDiseases, exhaustionVariant } = character.conditionsAndDiseases || {
    activeConditions: [],
    activeDiseases: [],
    exhaustionVariant: '2024' as const
  };

  // Filter conditions and diseases based on search
  const filteredConditions = availableConditions.filter(condition =>
    condition.name.toLowerCase().includes(conditionSearch.toLowerCase()) ||
    condition.description.toLowerCase().includes(conditionSearch.toLowerCase())
  );

  const filteredDiseases = availableDiseases.filter(disease =>
    disease.name.toLowerCase().includes(diseaseSearch.toLowerCase()) ||
    disease.description.toLowerCase().includes(diseaseSearch.toLowerCase())
  );

  // Get exhaustion level for current variant
  const exhaustionCondition = activeConditions.find(c => c.name.toLowerCase() === 'exhaustion');
  const exhaustionLevel = exhaustionCondition?.count || 0;

  // Modal management
  const openConditionModal = (condition: ActiveCondition) => {
    setSelectedCondition(condition);
    setSelectedDisease(null);
    setIsModalOpen(true);
  };

  const openDiseaseModal = (disease: ActiveDisease) => {
    setSelectedDisease(disease);
    setSelectedCondition(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCondition(null);
    setSelectedDisease(null);
  };

  const handleUpdateConditionNotes = (notes: string) => {
    if (selectedCondition) {
      updateCondition(selectedCondition.id, { notes });
      setSelectedCondition({ ...selectedCondition, notes });
    }
  };

  const handleUpdateDiseaseNotes = (notes: string) => {
    if (selectedDisease) {
      updateDisease(selectedDisease.id, { notes });
      setSelectedDisease({ ...selectedDisease, notes });
    }
  };

  const handleUpdateDiseaseOnsetTime = (onsetTime: string) => {
    if (selectedDisease) {
      updateDisease(selectedDisease.id, { onsetTime });
      setSelectedDisease({ ...selectedDisease, onsetTime });
    }
  };

  const handleAddCondition = (condition: ProcessedCondition) => {
    // For exhaustion, check if we already have it and update count instead
    if (condition.isExhaustion) {
      const existing = activeConditions.find(c => c.name.toLowerCase() === 'exhaustion');
      if (existing) {
        updateCondition(existing.id, { count: Math.min(existing.count + 1, 6) });
        return;
      }
    }

    addCondition(
      condition.name,
      condition.source,
      condition.description,
      condition.stackable ? 1 : 1
    );
  };

  const handleExhaustionChange = (delta: number) => {
    const existing = activeConditions.find(c => c.name.toLowerCase() === 'exhaustion');
    
    if (!existing && delta > 0) {
      // Add exhaustion if it doesn't exist
      getExhaustionByVariant(exhaustionVariant).then(exhaustionData => {
        if (exhaustionData) {
          addCondition(exhaustionData.name, exhaustionData.source, exhaustionData.description, 1);
        }
      });
    } else if (existing) {
      const newCount = Math.max(0, Math.min(6, existing.count + delta));
      if (newCount === 0) {
        removeCondition(existing.id);
      } else {
        updateCondition(existing.id, { count: newCount });
      }
    }
  };

  const renderConditionCard = (condition: ActiveCondition) => {
    const fullSourceName = SPELL_SOURCE_BOOKS[condition.source] || condition.source;
    
    return (
      <div key={condition.id} className="bg-white border border-red-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-bold text-red-800 flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" />
              {condition.name}
              {condition.stackable && condition.count > 1 && (
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">
                  Level {condition.count}
                </span>
              )}
            </h4>
            <p className="text-sm text-gray-800 mb-1">
              <span className="font-medium">{fullSourceName}</span>
            </p>
            <p className="text-xs text-gray-700">
              Applied: {new Date(condition.appliedAt).toLocaleDateString()}
            </p>
            {condition.notes && (
              <p className="text-xs text-blue-800 mt-1 font-medium">
                📝 Has notes
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {condition.stackable && (
              <>
                <button
                  onClick={() => updateCondition(condition.id, { count: Math.max(1, condition.count - 1) })}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  disabled={condition.count <= 1}
                  title="Decrease level"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="px-2 text-sm font-bold text-gray-800">{condition.count}</span>
                <button
                  onClick={() => updateCondition(condition.id, { count: Math.min(6, condition.count + 1) })}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  disabled={condition.count >= 6}
                  title="Increase level"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </>
            )}
            <button
              onClick={() => openConditionModal(condition)}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="View details"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => removeCondition(condition.id)}
              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Remove condition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDiseaseCard = (disease: ActiveDisease) => {
    const fullSourceName = SPELL_SOURCE_BOOKS[disease.source] || disease.source;
    
    return (
      <div key={disease.id} className="bg-white border border-purple-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h4 className="font-bold text-purple-800 flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4" />
              {disease.name}
            </h4>
            <p className="text-sm text-gray-800 mb-1">
              <span className="font-medium">{fullSourceName}</span>
            </p>
            <p className="text-xs text-gray-700">
              Applied: {new Date(disease.appliedAt).toLocaleDateString()}
              {disease.onsetTime && ` • Onset: ${new Date(disease.onsetTime).toLocaleDateString()}`}
            </p>
            {disease.notes && (
              <p className="text-xs text-blue-800 mt-1 font-medium">
                📝 Has notes
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openDiseaseModal(disease)}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="View details"
            >
              <Eye className="w-3 h-3" />
            </button>
            <button
              onClick={() => removeDisease(disease.id)}
              className="p-1 text-purple-600 hover:bg-purple-50 rounded transition-colors"
              title="Remove disease"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading conditions and diseases...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Conditions & Diseases
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Exhaustion Rules:</label>
            <select
              value={exhaustionVariant}
              onChange={(e) => setExhaustionVariant(e.target.value as ExhaustionVariant)}
              className="p-1 border border-gray-300 rounded text-sm text-gray-800 bg-white"
            >
              <option value="2014">2014 PHB</option>
              <option value="2024">2024 PHB</option>
            </select>
          </div>
          <Settings className="w-4 h-4 text-gray-500" />
        </div>
      </div>

      {/* Exhaustion Quick Controls */}
      <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-bold text-red-800">Exhaustion Level</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExhaustionChange(-1)}
              className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
              disabled={exhaustionLevel === 0}
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-white border border-red-200 rounded font-bold min-w-[3rem] text-center text-gray-800">
              {exhaustionLevel} / 6
            </span>
            <button
              onClick={() => handleExhaustionChange(1)}
              className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50"
              disabled={exhaustionLevel >= 6}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-red-700">
          Using {exhaustionVariant === '2014' ? '2014' : '2024'} rules • 
          {exhaustionLevel === 6 ? ' Death!' : exhaustionLevel === 0 ? ' No exhaustion' : ` Level ${exhaustionLevel}`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Conditions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-red-800">Active Conditions ({activeConditions.length})</h4>
            {activeConditions.length > 0 && (
              <button
                onClick={clearAllConditions}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>
          
          <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
            {activeConditions.map(renderConditionCard)}
            {activeConditions.length === 0 && (
              <p className="text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded">
                No active conditions
              </p>
            )}
          </div>

          {/* Add Conditions */}
          <div className="border-t border-gray-200 pt-4">
            <h5 className="font-medium text-gray-700 mb-2">Add Condition</h5>
            <div className="flex gap-2 mb-2">
              <Search className="w-4 h-4 text-gray-500 mt-1" />
              <input
                type="text"
                placeholder="Search conditions..."
                value={conditionSearch}
                onChange={(e) => setConditionSearch(e.target.value)}
                className="flex-1 p-1 border border-gray-300 rounded text-sm text-gray-800 placeholder:text-gray-600"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredConditions.map(condition => {
                const fullSourceName = SPELL_SOURCE_BOOKS[condition.source] || condition.source;
                return (
                  <button
                    key={condition.id}
                    onClick={() => handleAddCondition(condition)}
                    className="w-full text-left p-3 text-sm hover:bg-red-50 border border-red-100 rounded-lg transition-colors hover:border-red-200"
                  >
                    <div className="font-medium text-gray-800">{condition.name}</div>
                    <div className="text-xs text-gray-700 mt-1">{fullSourceName}</div>
                    {condition.variant && (
                      <div className="text-xs text-blue-700 font-medium mt-1">
                        {condition.variant === '2014' ? '2014 PHB' : '2024 PHB'}
                      </div>
                    )}
                  </button>
                );
              })}
              {filteredConditions.length === 0 && conditionSearch && (
                <p className="text-center py-4 text-gray-500 text-sm">
                  No conditions found matching &quot;{conditionSearch}&quot;
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Active Diseases */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-purple-800">Active Diseases ({activeDiseases.length})</h4>
            {activeDiseases.length > 0 && (
              <button
                onClick={clearAllDiseases}
                className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            )}
          </div>
          
          <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
            {activeDiseases.map(renderDiseaseCard)}
            {activeDiseases.length === 0 && (
              <p className="text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded">
                No active diseases
              </p>
            )}
          </div>

          {/* Add Diseases */}
          <div className="border-t border-gray-200 pt-4">
            <h5 className="font-medium text-gray-700 mb-2">Add Disease</h5>
            <div className="flex gap-2 mb-2">
              <Search className="w-4 h-4 text-gray-500 mt-1" />
              <input
                type="text"
                placeholder="Search diseases..."
                value={diseaseSearch}
                onChange={(e) => setDiseaseSearch(e.target.value)}
                className="flex-1 p-1 border border-gray-300 rounded text-sm text-gray-800 placeholder:text-gray-600"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredDiseases.map(disease => {
                const fullSourceName = SPELL_SOURCE_BOOKS[disease.source] || disease.source;
                return (
                  <button
                    key={disease.id}
                    onClick={() => addDisease(disease.name, disease.source, disease.description)}
                    className="w-full text-left p-3 text-sm hover:bg-purple-50 border border-purple-100 rounded-lg transition-colors hover:border-purple-200"
                  >
                    <div className="font-medium text-gray-800">{disease.name}</div>
                    <div className="text-xs text-gray-700 mt-1">
                      {fullSourceName}
                      {disease.type && <span className="text-purple-700 font-medium"> • {disease.type}</span>}
                    </div>
                  </button>
                );
              })}
              {filteredDiseases.length === 0 && diseaseSearch && (
                <p className="text-center py-4 text-gray-500 text-sm">
                  No diseases found matching &quot;{diseaseSearch}&quot;
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <ConditionDetailsModal
        isOpen={isModalOpen}
        onClose={closeModal}
        condition={selectedCondition || undefined}
        disease={selectedDisease || undefined}
        onUpdateNotes={selectedCondition ? handleUpdateConditionNotes : handleUpdateDiseaseNotes}
        onUpdateOnsetTime={handleUpdateDiseaseOnsetTime}
      />
    </div>
  );
} 