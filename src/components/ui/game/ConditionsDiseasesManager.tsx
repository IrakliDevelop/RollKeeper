'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Minus,
  AlertTriangle,
  Shield,
  Search,
  Trash2,
  Activity,
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
import { ConditionCard, DiseaseCard } from './conditions';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';

type TabType = 'conditions' | 'diseases';

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
  const [activeTab, setActiveTab] = useState<TabType>('conditions');
  const [conditionSearch, setConditionSearch] = useState('');
  const [diseaseSearch, setDiseaseSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCondition, setSelectedCondition] =
    useState<ActiveCondition | null>(null);
  const [selectedDisease, setSelectedDisease] = useState<ActiveDisease | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

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
    setShowAddPanel(false);
    setConditionSearch('');
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

  const handleAddDisease = (disease: ProcessedDisease) => {
    addDisease(disease.name, disease.source, disease.description);
    setShowAddPanel(false);
    setDiseaseSearch('');
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
          <p className="mt-4 text-gray-600 font-medium">
            Loading conditions and diseases...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <Activity className="h-6 w-6 text-red-600" />
            Conditions & Diseases
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">
              Exhaustion Rules:
            </label>
            <SelectField
              value={exhaustionVariant}
              onValueChange={value =>
                setExhaustionVariant(value as ExhaustionVariant)
              }
            >
              <SelectItem value="2014">2014 PHB</SelectItem>
              <SelectItem value="2024">2024 PHB</SelectItem>
            </SelectField>
          </div>
        </div>

        {/* Exhaustion Quick Controls */}
        <div className="rounded-lg border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h4 className="font-bold text-red-800">Exhaustion Level</h4>
                <p className="text-xs text-red-700">
                  Using {exhaustionVariant === '2014' ? '2014' : '2024'} rules
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleExhaustionChange(-1)}
                variant="ghost"
                size="sm"
                disabled={exhaustionLevel === 0}
                className="text-red-600 hover:bg-red-100 hover:text-red-800 disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="min-w-[4rem] text-center">
                <div className="text-2xl font-bold text-gray-800">
                  {exhaustionLevel}
                </div>
                <div className="text-xs text-gray-600">/ 6</div>
              </div>
              <Button
                onClick={() => handleExhaustionChange(1)}
                variant="ghost"
                size="sm"
                disabled={exhaustionLevel >= 6}
                className="text-red-600 hover:bg-red-100 hover:text-red-800 disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {exhaustionLevel > 0 && (
            <Badge
              variant={exhaustionLevel >= 6 ? 'danger' : 'warning'}
              size="md"
              className="mt-3"
            >
              {exhaustionLevel === 6
                ? '☠️ Death!'
                : `Level ${exhaustionLevel} Effects Active`}
            </Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b-2 border-gray-200 bg-gray-50 px-6">
        <div className="flex gap-1">
          <button
            onClick={() => {
              setActiveTab('conditions');
              setShowAddPanel(false);
            }}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
              activeTab === 'conditions'
                ? 'border-b-4 border-red-600 text-red-700 bg-white'
                : 'text-gray-600 hover:text-red-600 hover:bg-gray-100'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Conditions
            <Badge variant={activeTab === 'conditions' ? 'danger' : 'secondary'} size="sm">
              {activeConditions.length}
            </Badge>
          </button>
          <button
            onClick={() => {
              setActiveTab('diseases');
              setShowAddPanel(false);
            }}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
              activeTab === 'diseases'
                ? 'border-b-4 border-purple-600 text-purple-700 bg-white'
                : 'text-gray-600 hover:text-purple-600 hover:bg-gray-100'
            }`}
          >
            <Shield className="h-4 w-4" />
            Diseases
            <Badge variant={activeTab === 'diseases' ? 'primary' : 'secondary'} size="sm">
              {activeDiseases.length}
            </Badge>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'conditions' ? (
          <div className="space-y-4">
            {/* Active Conditions Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-800">
                Active Conditions
              </h4>
              <div className="flex gap-2">
                {activeConditions.length > 0 && (
                  <Button
                    onClick={clearAllConditions}
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    className="text-red-600 hover:bg-red-50 hover:text-red-800"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  onClick={() => setShowAddPanel(!showAddPanel)}
                  variant={showAddPanel ? 'outline' : 'primary'}
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  className={
                    showAddPanel
                      ? ''
                      : 'bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700'
                  }
                >
                  {showAddPanel ? 'Cancel' : 'Add Condition'}
                </Button>
              </div>
            </div>

            {/* Add Condition Panel */}
            {showAddPanel && (
              <div className="rounded-lg border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4">
                <h5 className="mb-3 font-bold text-red-800">
                  Add New Condition
                </h5>
                <Input
                  leftIcon={<Search className="h-4 w-4" />}
                  placeholder="Search conditions by name or description..."
                  value={conditionSearch}
                  onChange={e => setConditionSearch(e.target.value)}
                  className="mb-3"
                />
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredConditions.map(condition => {
                    const fullSourceName =
                      SPELL_SOURCE_BOOKS[condition.source] || condition.source;
                    return (
                      <button
                        key={condition.id}
                        onClick={() => handleAddCondition(condition)}
                        className="w-full rounded-lg border-2 border-white bg-white p-3 text-left transition-all hover:border-red-200 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">
                              {condition.name}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                              <span>{fullSourceName}</span>
                              {condition.variant && (
                                <Badge variant="info" size="sm">
                                  {condition.variant === '2014'
                                    ? '2014 PHB'
                                    : '2024 PHB'}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Plus className="h-5 w-5 text-red-600" />
                        </div>
                      </button>
                    );
                  })}
                  {filteredConditions.length === 0 && conditionSearch && (
                    <p className="py-8 text-center text-gray-500">
                      No conditions found matching &quot;{conditionSearch}&quot;
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Active Conditions List */}
            <div className="space-y-3">
              {activeConditions.map(condition => (
                <ConditionCard
                  key={condition.id}
                  condition={condition}
                  onView={openConditionModal}
                  onRemove={removeCondition}
                  onUpdateCount={(id, count) =>
                    updateCondition(id, { count })
                  }
                />
              ))}
              {activeConditions.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
                  <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                  <p className="text-gray-600 font-medium">
                    No active conditions
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Click &quot;Add Condition&quot; to get started
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Diseases Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-gray-800">
                Active Diseases
              </h4>
              <div className="flex gap-2">
                {activeDiseases.length > 0 && (
                  <Button
                    onClick={clearAllDiseases}
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    className="text-purple-600 hover:bg-purple-50 hover:text-purple-800"
                  >
                    Clear All
                  </Button>
                )}
                <Button
                  onClick={() => setShowAddPanel(!showAddPanel)}
                  variant={showAddPanel ? 'outline' : 'primary'}
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  className={
                    showAddPanel
                      ? ''
                      : 'bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700'
                  }
                >
                  {showAddPanel ? 'Cancel' : 'Add Disease'}
                </Button>
              </div>
            </div>

            {/* Add Disease Panel */}
            {showAddPanel && (
              <div className="rounded-lg border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-violet-50 p-4">
                <h5 className="mb-3 font-bold text-purple-800">
                  Add New Disease
                </h5>
                <Input
                  leftIcon={<Search className="h-4 w-4" />}
                  placeholder="Search diseases by name or description..."
                  value={diseaseSearch}
                  onChange={e => setDiseaseSearch(e.target.value)}
                  className="mb-3"
                />
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredDiseases.map(disease => {
                    const fullSourceName =
                      SPELL_SOURCE_BOOKS[disease.source] || disease.source;
                    return (
                      <button
                        key={disease.id}
                        onClick={() => handleAddDisease(disease)}
                        className="w-full rounded-lg border-2 border-white bg-white p-3 text-left transition-all hover:border-purple-200 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800">
                              {disease.name}
                            </div>
                            <div className="mt-1 text-xs text-gray-600">
                              {fullSourceName}
                              {disease.type && (
                                <span className="font-medium text-purple-700">
                                  {' '}
                                  • {disease.type}
                                </span>
                              )}
                            </div>
                          </div>
                          <Plus className="h-5 w-5 text-purple-600" />
                        </div>
                      </button>
                    );
                  })}
                  {filteredDiseases.length === 0 && diseaseSearch && (
                    <p className="py-8 text-center text-gray-500">
                      No diseases found matching &quot;{diseaseSearch}&quot;
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Active Diseases List */}
            <div className="space-y-3">
              {activeDiseases.map(disease => (
                <DiseaseCard
                  key={disease.id}
                  disease={disease}
                  onView={openDiseaseModal}
                  onRemove={removeDisease}
                />
              ))}
              {activeDiseases.length === 0 && (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
                  <Shield className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                  <p className="text-gray-600 font-medium">No active diseases</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Click &quot;Add Disease&quot; to get started
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
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
