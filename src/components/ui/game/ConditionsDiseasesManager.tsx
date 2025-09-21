'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  X,
  AlertTriangle,
  Shield,
  Eye,
  Settings,
  Search,
  Trash2,
} from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import {
  loadAllConditions,
  loadAllDiseases,
  getExhaustionByVariant,
} from '@/utils/conditionsDiseasesLoader';
import {
  ProcessedCondition,
  ProcessedDisease,
  ActiveCondition,
  ActiveDisease,
  ExhaustionVariant,
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
    clearAllDiseases,
  } = useCharacterStore();

  const [availableConditions, setAvailableConditions] = useState<
    ProcessedCondition[]
  >([]);
  const [availableDiseases, setAvailableDiseases] = useState<
    ProcessedDisease[]
  >([]);
  const [conditionSearch, setConditionSearch] = useState('');
  const [diseaseSearch, setDiseaseSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCondition, setSelectedCondition] =
    useState<ActiveCondition | null>(null);
  const [selectedDisease, setSelectedDisease] = useState<ActiveDisease | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load conditions and diseases data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [conditions, diseases] = await Promise.all([
          loadAllConditions(),
          loadAllDiseases(),
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

  const { activeConditions, activeDiseases, exhaustionVariant } =
    character.conditionsAndDiseases || {
      activeConditions: [],
      activeDiseases: [],
      exhaustionVariant: '2024' as const,
    };

  // Filter conditions and diseases based on search
  const filteredConditions = availableConditions.filter(
    condition =>
      condition.name.toLowerCase().includes(conditionSearch.toLowerCase()) ||
      condition.description
        .toLowerCase()
        .includes(conditionSearch.toLowerCase())
  );

  const filteredDiseases = availableDiseases.filter(
    disease =>
      disease.name.toLowerCase().includes(diseaseSearch.toLowerCase()) ||
      disease.description.toLowerCase().includes(diseaseSearch.toLowerCase())
  );

  // Get exhaustion level for current variant
  const exhaustionCondition = activeConditions.find(
    c => c.name.toLowerCase() === 'exhaustion'
  );
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
      const existing = activeConditions.find(
        c => c.name.toLowerCase() === 'exhaustion'
      );
      if (existing) {
        updateCondition(existing.id, {
          count: Math.min(existing.count + 1, 6),
        });
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
    const existing = activeConditions.find(
      c => c.name.toLowerCase() === 'exhaustion'
    );

    if (!existing && delta > 0) {
      // Add exhaustion if it doesn't exist
      getExhaustionByVariant(exhaustionVariant).then(exhaustionData => {
        if (exhaustionData) {
          addCondition(
            exhaustionData.name,
            exhaustionData.source,
            exhaustionData.description,
            1
          );
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
    const fullSourceName =
      SPELL_SOURCE_BOOKS[condition.source] || condition.source;

    return (
      <div
        key={condition.id}
        className="rounded-lg border border-red-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1">
            <h4 className="mb-1 flex items-center gap-2 font-bold text-red-800">
              <AlertTriangle className="h-4 w-4" />
              {condition.name}
              {condition.stackable && condition.count > 1 && (
                <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
                  Level {condition.count}
                </span>
              )}
            </h4>
            <p className="mb-1 text-sm text-gray-800">
              <span className="font-medium">{fullSourceName}</span>
            </p>
            <p className="text-xs text-gray-700">
              Applied: {new Date(condition.appliedAt).toLocaleDateString()}
            </p>
            {condition.notes && (
              <p className="mt-1 text-xs font-medium text-blue-800">
                📝 Has notes
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {condition.stackable && (
              <>
                <button
                  onClick={() =>
                    updateCondition(condition.id, {
                      count: Math.max(1, condition.count - 1),
                    })
                  }
                  className="rounded p-1 text-red-600 transition-colors hover:bg-red-50"
                  disabled={condition.count <= 1}
                  title="Decrease level"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="px-2 text-sm font-bold text-gray-800">
                  {condition.count}
                </span>
                <button
                  onClick={() =>
                    updateCondition(condition.id, {
                      count: Math.min(6, condition.count + 1),
                    })
                  }
                  className="rounded p-1 text-red-600 transition-colors hover:bg-red-50"
                  disabled={condition.count >= 6}
                  title="Increase level"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </>
            )}
            <button
              onClick={() => openConditionModal(condition)}
              className="rounded p-1 text-blue-600 transition-colors hover:bg-blue-50"
              title="View details"
            >
              <Eye className="h-3 w-3" />
            </button>
            <button
              onClick={() => removeCondition(condition.id)}
              className="rounded p-1 text-red-600 transition-colors hover:bg-red-50"
              title="Remove condition"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDiseaseCard = (disease: ActiveDisease) => {
    const fullSourceName = SPELL_SOURCE_BOOKS[disease.source] || disease.source;

    return (
      <div
        key={disease.id}
        className="rounded-lg border border-purple-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1">
            <h4 className="mb-1 flex items-center gap-2 font-bold text-purple-800">
              <Shield className="h-4 w-4" />
              {disease.name}
            </h4>
            <p className="mb-1 text-sm text-gray-800">
              <span className="font-medium">{fullSourceName}</span>
            </p>
            <p className="text-xs text-gray-700">
              Applied: {new Date(disease.appliedAt).toLocaleDateString()}
              {disease.onsetTime &&
                ` • Onset: ${new Date(disease.onsetTime).toLocaleDateString()}`}
            </p>
            {disease.notes && (
              <p className="mt-1 text-xs font-medium text-blue-800">
                📝 Has notes
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => openDiseaseModal(disease)}
              className="rounded p-1 text-blue-600 transition-colors hover:bg-blue-50"
              title="View details"
            >
              <Eye className="h-3 w-3" />
            </button>
            <button
              onClick={() => removeDisease(disease.id)}
              className="rounded p-1 text-purple-600 transition-colors hover:bg-purple-50"
              title="Remove disease"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
        <div className="py-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">
            Loading conditions and diseases...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          Conditions & Diseases
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Exhaustion Rules:
            </label>
            <select
              value={exhaustionVariant}
              onChange={e =>
                setExhaustionVariant(e.target.value as ExhaustionVariant)
              }
              className="rounded border border-gray-300 bg-white p-1 text-sm text-gray-800"
            >
              <option value="2014">2014 PHB</option>
              <option value="2024">2024 PHB</option>
            </select>
          </div>
          <Settings className="h-4 w-4 text-gray-500" />
        </div>
      </div>

      {/* Exhaustion Quick Controls */}
      <div className="mb-6 rounded-lg border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-bold text-red-800">Exhaustion Level</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExhaustionChange(-1)}
              className="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
              disabled={exhaustionLevel === 0}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[3rem] rounded border border-red-200 bg-white px-3 py-1 text-center font-bold text-gray-800">
              {exhaustionLevel} / 6
            </span>
            <button
              onClick={() => handleExhaustionChange(1)}
              className="rounded p-1 text-red-600 hover:bg-red-100 disabled:opacity-50"
              disabled={exhaustionLevel >= 6}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-red-700">
          Using {exhaustionVariant === '2014' ? '2014' : '2024'} rules •
          {exhaustionLevel === 6
            ? ' Death!'
            : exhaustionLevel === 0
              ? ' No exhaustion'
              : ` Level ${exhaustionLevel}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active Conditions */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-bold text-red-800">
              Active Conditions ({activeConditions.length})
            </h4>
            {activeConditions.length > 0 && (
              <button
                onClick={clearAllConditions}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>

          <div className="mb-4 max-h-60 space-y-3 overflow-y-auto">
            {activeConditions.map(renderConditionCard)}
            {activeConditions.length === 0 && (
              <p className="rounded border border-dashed border-gray-300 py-4 text-center text-gray-500">
                No active conditions
              </p>
            )}
          </div>

          {/* Add Conditions */}
          <div className="border-t border-gray-200 pt-4">
            <h5 className="mb-2 font-medium text-gray-700">Add Condition</h5>
            <div className="mb-2 flex gap-2">
              <Search className="mt-1 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search conditions..."
                value={conditionSearch}
                onChange={e => setConditionSearch(e.target.value)}
                className="flex-1 rounded border border-gray-300 p-1 text-sm text-gray-800 placeholder:text-gray-600"
              />
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {filteredConditions.map(condition => {
                const fullSourceName =
                  SPELL_SOURCE_BOOKS[condition.source] || condition.source;
                return (
                  <button
                    key={condition.id}
                    onClick={() => handleAddCondition(condition)}
                    className="w-full rounded-lg border border-red-100 p-3 text-left text-sm transition-colors hover:border-red-200 hover:bg-red-50"
                  >
                    <div className="font-medium text-gray-800">
                      {condition.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-700">
                      {fullSourceName}
                    </div>
                    {condition.variant && (
                      <div className="mt-1 text-xs font-medium text-blue-700">
                        {condition.variant === '2014' ? '2014 PHB' : '2024 PHB'}
                      </div>
                    )}
                  </button>
                );
              })}
              {filteredConditions.length === 0 && conditionSearch && (
                <p className="py-4 text-center text-sm text-gray-500">
                  No conditions found matching &quot;{conditionSearch}&quot;
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Active Diseases */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h4 className="font-bold text-purple-800">
              Active Diseases ({activeDiseases.length})
            </h4>
            {activeDiseases.length > 0 && (
              <button
                onClick={clearAllDiseases}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
              >
                <Trash2 className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>

          <div className="mb-4 max-h-60 space-y-3 overflow-y-auto">
            {activeDiseases.map(renderDiseaseCard)}
            {activeDiseases.length === 0 && (
              <p className="rounded border border-dashed border-gray-300 py-4 text-center text-gray-500">
                No active diseases
              </p>
            )}
          </div>

          {/* Add Diseases */}
          <div className="border-t border-gray-200 pt-4">
            <h5 className="mb-2 font-medium text-gray-700">Add Disease</h5>
            <div className="mb-2 flex gap-2">
              <Search className="mt-1 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search diseases..."
                value={diseaseSearch}
                onChange={e => setDiseaseSearch(e.target.value)}
                className="flex-1 rounded border border-gray-300 p-1 text-sm text-gray-800 placeholder:text-gray-600"
              />
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {filteredDiseases.map(disease => {
                const fullSourceName =
                  SPELL_SOURCE_BOOKS[disease.source] || disease.source;
                return (
                  <button
                    key={disease.id}
                    onClick={() =>
                      addDisease(
                        disease.name,
                        disease.source,
                        disease.description
                      )
                    }
                    className="w-full rounded-lg border border-purple-100 p-3 text-left text-sm transition-colors hover:border-purple-200 hover:bg-purple-50"
                  >
                    <div className="font-medium text-gray-800">
                      {disease.name}
                    </div>
                    <div className="mt-1 text-xs text-gray-700">
                      {fullSourceName}
                      {disease.type && (
                        <span className="font-medium text-purple-700">
                          {' '}
                          • {disease.type}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredDiseases.length === 0 && diseaseSearch && (
                <p className="py-4 text-center text-sm text-gray-500">
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
        onUpdateNotes={
          selectedCondition
            ? handleUpdateConditionNotes
            : handleUpdateDiseaseNotes
        }
        onUpdateOnsetTime={handleUpdateDiseaseOnsetTime}
      />
    </div>
  );
}
