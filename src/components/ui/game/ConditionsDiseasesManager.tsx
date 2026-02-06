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
      <div className="border-divider bg-surface rounded-lg border-2 p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="border-divider border-t-accent-blue-border-strong h-12 w-12 animate-spin rounded-full border-4"></div>
          <p className="text-muted mt-4 font-medium">
            Loading conditions and diseases...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-divider bg-surface rounded-lg border-2 shadow-sm">
      {/* Header */}
      <div className="border-divider from-surface-secondary to-surface-hover border-b-2 bg-linear-to-r p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-heading flex items-center gap-2 text-xl font-bold">
            <Activity className="text-accent-red-text-muted h-6 w-6" />
            Conditions & Diseases
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-body text-sm font-medium">
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
        <div className="border-accent-red-border from-accent-red-bg to-accent-orange-bg rounded-lg border-2 bg-linear-to-r p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-accent-red-text-muted h-5 w-5" />
              <div>
                <h4 className="text-accent-red-text font-bold">
                  Exhaustion Level
                </h4>
                <p className="text-accent-red-text-muted text-xs">
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
                className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="min-w-[4rem] text-center">
                <div className="text-heading text-2xl font-bold">
                  {exhaustionLevel}
                </div>
                <div className="text-muted text-xs">/ 6</div>
              </div>
              <Button
                onClick={() => handleExhaustionChange(1)}
                variant="ghost"
                size="sm"
                disabled={exhaustionLevel >= 6}
                className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text disabled:opacity-30"
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
      <div className="border-divider bg-surface-secondary border-b-2 px-6">
        <div className="flex gap-1">
          <button
            onClick={() => {
              setActiveTab('conditions');
              setShowAddPanel(false);
            }}
            className={`flex items-center gap-2 px-6 py-3 font-semibold transition-all ${
              activeTab === 'conditions'
                ? 'border-accent-red-border-strong text-accent-red-text bg-surface border-b-4'
                : 'text-muted hover:text-accent-red-text-muted hover:bg-surface-hover'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Conditions
            <Badge
              variant={activeTab === 'conditions' ? 'danger' : 'secondary'}
              size="sm"
            >
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
                ? 'border-accent-purple-border-strong text-accent-purple-text bg-surface border-b-4'
                : 'text-muted hover:text-accent-purple-text-muted hover:bg-surface-hover'
            }`}
          >
            <Shield className="h-4 w-4" />
            Diseases
            <Badge
              variant={activeTab === 'diseases' ? 'primary' : 'secondary'}
              size="sm"
            >
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
              <h4 className="text-heading text-lg font-bold">
                Active Conditions
              </h4>
              <div className="flex gap-2">
                {activeConditions.length > 0 && (
                  <Button
                    onClick={clearAllConditions}
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    className="text-accent-red-text-muted hover:bg-accent-red-bg hover:text-accent-red-text"
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
                      : 'bg-linear-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600'
                  }
                >
                  {showAddPanel ? 'Cancel' : 'Add Condition'}
                </Button>
              </div>
            </div>

            {/* Add Condition Panel */}
            {showAddPanel && (
              <div className="border-accent-red-border from-accent-red-bg to-accent-orange-bg rounded-lg border-2 bg-linear-to-r p-4">
                <h5 className="text-accent-red-text mb-3 font-bold">
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
                        className="border-divider bg-surface-raised hover:border-accent-red-border w-full rounded-lg border-2 p-3 text-left transition-all hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-heading font-semibold">
                              {condition.name}
                            </div>
                            <div className="text-muted mt-1 flex items-center gap-2 text-xs">
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
                          <Plus className="text-accent-red-text-muted h-5 w-5" />
                        </div>
                      </button>
                    );
                  })}
                  {filteredConditions.length === 0 && conditionSearch && (
                    <p className="text-muted py-8 text-center">
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
                  onUpdateCount={(id, count) => updateCondition(id, { count })}
                />
              ))}
              {activeConditions.length === 0 && (
                <div className="border-divider-strong bg-surface-secondary rounded-lg border-2 border-dashed py-12 text-center">
                  <AlertTriangle className="text-faint mx-auto mb-3 h-12 w-12" />
                  <p className="text-muted font-medium">No active conditions</p>
                  <p className="text-muted mt-1 text-sm">
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
              <h4 className="text-heading text-lg font-bold">
                Active Diseases
              </h4>
              <div className="flex gap-2">
                {activeDiseases.length > 0 && (
                  <Button
                    onClick={clearAllDiseases}
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    className="text-accent-purple-text-muted hover:bg-accent-purple-bg hover:text-accent-purple-text"
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
                      : 'bg-linear-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700'
                  }
                >
                  {showAddPanel ? 'Cancel' : 'Add Disease'}
                </Button>
              </div>
            </div>

            {/* Add Disease Panel */}
            {showAddPanel && (
              <div className="border-accent-purple-border from-accent-purple-bg to-accent-purple-bg-strong rounded-lg border-2 bg-linear-to-r p-4">
                <h5 className="text-accent-purple-text mb-3 font-bold">
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
                        className="border-divider bg-surface-raised hover:border-accent-purple-border w-full rounded-lg border-2 p-3 text-left transition-all hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="text-heading font-semibold">
                              {disease.name}
                            </div>
                            <div className="text-muted mt-1 text-xs">
                              {fullSourceName}
                              {disease.type && (
                                <span className="text-accent-purple-text-muted font-medium">
                                  {' '}
                                  • {disease.type}
                                </span>
                              )}
                            </div>
                          </div>
                          <Plus className="text-accent-purple-text-muted h-5 w-5" />
                        </div>
                      </button>
                    );
                  })}
                  {filteredDiseases.length === 0 && diseaseSearch && (
                    <p className="text-muted py-8 text-center">
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
                <div className="border-divider-strong bg-surface-secondary rounded-lg border-2 border-dashed py-12 text-center">
                  <Shield className="text-faint mx-auto mb-3 h-12 w-12" />
                  <p className="text-muted font-medium">No active diseases</p>
                  <p className="text-muted mt-1 text-sm">
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
