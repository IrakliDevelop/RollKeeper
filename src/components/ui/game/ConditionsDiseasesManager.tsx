'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minus, Plus, Search } from 'lucide-react';
import { useCharacterStore } from '@/store/characterStore';
import { useExhaustionStepper } from '@/hooks/useExhaustionStepper';
import {
  loadAllConditions,
  loadAllDiseases,
} from '@/utils/conditionsDiseasesLoader';
import { SPELL_SOURCE_BOOKS } from '@/utils/constants';
import type {
  ActiveCondition,
  ActiveDisease,
  ExhaustionVariant,
  ProcessedCondition,
  ProcessedDisease,
} from '@/types/character';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { Badge } from '@/components/ui/layout/badge';
import { Section } from '@/components/ui/layout/section';
import { SubTabs } from '@/components/ui/layout/SubTabs';
import { ConditionChip } from '@/components/ui/game/ConditionChip';
import ConditionDetailsModal from './ConditionDetailsModal';
import { ConditionCard, DiseaseCard } from './conditions';

type TabType = 'conditions' | 'buffs' | 'diseases';
type Effect = ActiveCondition | ActiveDisease;

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
    clearNonBuffConditions,
    clearAllDiseases,
  } = useCharacterStore();
  const [availableConditions, setAvailableConditions] = useState<
    ProcessedCondition[]
  >([]);
  const [availableDiseases, setAvailableDiseases] = useState<
    ProcessedDisease[]
  >([]);
  const [activeTab, setActiveTab] = useState<TabType>('conditions');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] =
    useState<ActiveCondition | null>(null);
  const [selectedDisease, setSelectedDisease] = useState<ActiveDisease | null>(
    null
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<string | 'add' | null>(null);
  const exhaustion = useExhaustionStepper();

  useEffect(() => {
    let alive = true;
    Promise.all([loadAllConditions(), loadAllDiseases()])
      .then(([conditions, diseases]) => {
        if (!alive) return;
        setAvailableConditions(conditions);
        setAvailableDiseases(diseases);
      })
      .catch(error =>
        console.error('Failed to load conditions/diseases:', error)
      )
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const { activeConditions, activeDiseases, exhaustionVariant } =
    character.conditionsAndDiseases;
  const activeBuffs = activeConditions.filter(
    condition => condition.kind === 'buff'
  );
  const activeDebuffs = activeConditions.filter(
    condition => condition.kind !== 'buff'
  );
  const currentList: Effect[] =
    activeTab === 'conditions'
      ? activeDebuffs
      : activeTab === 'buffs'
        ? activeBuffs
        : activeDiseases;

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const row = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[data-effect-row]') ?? []
    ).find(element => element.dataset.effectRow === target);
    const next =
      row?.querySelector<HTMLElement>('[data-effect-action="details"]') ??
      addButtonRef.current ??
      document.getElementById(`effects-${activeTab}`);
    next?.focus({ preventScroll: true });
  }, [activeConditions, activeDiseases, activeTab]);

  const handleRemove = (id: string) => {
    const index = currentList.findIndex(effect => effect.id === id);
    pendingFocus.current =
      currentList[index + 1]?.id ?? currentList[index - 1]?.id ?? 'add';
    if (activeTab === 'diseases') removeDisease(id);
    else removeCondition(id);
  };

  const handleClear = async () => {
    const diseases = activeTab === 'diseases';
    const confirmed = await confirmDialog({
      title: diseases ? 'Remove all diseases?' : 'Remove all conditions?',
      confirmLabel: 'Remove all',
      tone: 'danger',
    });
    if (!confirmed) return;
    pendingFocus.current = 'add';
    if (diseases) clearAllDiseases();
    else clearNonBuffConditions();
  };

  const handleAdd = (effect: ProcessedCondition | ProcessedDisease) => {
    if (activeTab === 'diseases') {
      addDisease(effect.name, effect.source, effect.description);
    } else {
      const condition = effect as ProcessedCondition;
      if (condition.isExhaustion) {
        const current = activeConditions.find(
          item => item.name.toLowerCase() === 'exhaustion'
        );
        if (current)
          updateCondition(current.id, {
            count: Math.min(current.count + 1, 6),
          });
        else
          addCondition(
            condition.name,
            condition.source,
            condition.description,
            1
          );
      } else {
        addCondition(
          condition.name,
          condition.source,
          condition.description,
          1
        );
      }
    }
    setPickerOpen(false);
    setSearch('');
  };

  const openDetails = (effect: Effect) => {
    if (activeTab === 'diseases') {
      setSelectedDisease(effect as ActiveDisease);
      setSelectedCondition(null);
    } else {
      setSelectedCondition(effect as ActiveCondition);
      setSelectedDisease(null);
    }
    setDetailsOpen(true);
  };

  const renderPanel = (tab: TabType) => {
    const effects: Effect[] =
      tab === 'conditions'
        ? activeDebuffs
        : tab === 'buffs'
          ? activeBuffs
          : activeDiseases;
    return (
      <div>
        {tab !== 'buffs' && (
          <div className="mb-2 flex flex-wrap justify-end gap-2">
            {effects.length > 0 && (
              <Button variant="danger" size="sm" onClick={handleClear}>
                Clear all
              </Button>
            )}
            <Button
              ref={tab === activeTab ? addButtonRef : undefined}
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearch('');
                setPickerOpen(true);
              }}
            >
              {tab === 'diseases' ? 'Add disease' : 'Add condition'}
            </Button>
          </div>
        )}
        <div
          ref={tab === activeTab ? listRef : undefined}
          role="list"
          className="divide-divider divide-y"
        >
          {effects.map(effect =>
            tab === 'diseases' ? (
              <DiseaseCard
                key={effect.id}
                disease={effect as ActiveDisease}
                onView={openDetails}
                onRemove={handleRemove}
              />
            ) : (
              <ConditionCard
                key={effect.id}
                condition={effect as ActiveCondition}
                onView={openDetails}
                onRemove={handleRemove}
                onUpdateCount={(id, count) => updateCondition(id, { count })}
              />
            )
          )}
        </div>
        {effects.length === 0 && (
          <p className="type-body text-muted py-8 text-center">
            {tab === 'conditions'
              ? 'No conditions.'
              : tab === 'buffs'
                ? 'Buffs such as Bless appear here when applied.'
                : 'No diseases.'}
          </p>
        )}
      </div>
    );
  };

  if (isLoading)
    return (
      <p className="type-body text-muted py-8 text-center">
        Loading conditions and diseases…
      </p>
    );

  const pickerOptions = (
    activeTab === 'diseases' ? availableDiseases : availableConditions
  ).filter(
    effect =>
      effect.name.toLowerCase().includes(search.toLowerCase()) ||
      effect.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Section
      heading="Conditions and effects"
      level={3}
      trailing={
        <div className="w-28 sm:w-32">
          <SelectField
            triggerProps={{ 'aria-label': 'Exhaustion rules' }}
            value={exhaustionVariant}
            onValueChange={value =>
              setExhaustionVariant(value as ExhaustionVariant)
            }
          >
            <SelectItem value="2014">2014 PHB</SelectItem>
            <SelectItem value="2024">2024 PHB</SelectItem>
          </SelectField>
        </div>
      }
    >
      <div className="border-divider flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {exhaustion.level > 0 ? (
            <ConditionChip name="Exhaustion" />
          ) : (
            <span className="type-ui text-heading">Exhaustion</span>
          )}
          <span className="type-small text-muted">
            Using {exhaustionVariant} rules
          </span>
          {exhaustion.level > 0 && (
            <Badge
              variant={exhaustion.level >= 6 ? 'danger' : 'warning'}
              size="sm"
            >
              {exhaustion.level >= 6
                ? 'Dead'
                : `Level ${exhaustion.level} effects`}
            </Badge>
          )}
        </div>
        <div
          role="group"
          aria-label="Exhaustion level"
          className="flex items-center gap-1"
        >
          <Button
            variant="ghost"
            size="sm"
            aria-label="Lower Exhaustion level"
            disabled={exhaustion.level === 0}
            onClick={() => exhaustion.decrement()}
            className="min-w-6 px-2 pointer-coarse:min-w-11"
          >
            <Minus aria-hidden="true" className="size-4" />
          </Button>
          <span className="type-num-md text-heading min-w-6 text-center">
            {exhaustion.level}
          </span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Raise Exhaustion level"
            disabled={exhaustion.level >= 6}
            onClick={() => {
              void exhaustion.increment();
            }}
            className="min-w-6 px-2 pointer-coarse:min-w-11"
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
          <span className="type-small text-muted">/ 6</span>
        </div>
      </div>

      <SubTabs
        label="Conditions and effects"
        value={activeTab}
        onValueChange={value => {
          setActiveTab(value as TabType);
          setPickerOpen(false);
        }}
        tabs={(
          [
            ['conditions', 'Conditions', activeDebuffs.length],
            ['buffs', 'Buffs', activeBuffs.length],
            ['diseases', 'Diseases', activeDiseases.length],
          ] as const
        ).map(([value, label, count]) => ({
          id: `effects-${value}`,
          value,
          label: (
            <span className="inline-flex items-center gap-1">
              {label}
              <Badge variant="neutral" size="sm">
                {count}
              </Badge>
            </span>
          ),
          content: renderPanel(value),
        }))}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'diseases' ? 'Add disease' : 'Add condition'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Input
              leftIcon={<Search aria-hidden="true" className="size-4" />}
              aria-label={
                activeTab === 'diseases'
                  ? 'Search diseases'
                  : 'Search conditions'
              }
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <div className="divide-divider mt-4 max-h-72 divide-y overflow-y-auto">
              {pickerOptions.map(effect => (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => handleAdd(effect)}
                  className="hover:bg-surface-hover focus-visible:outline-ring flex w-full min-w-0 items-center justify-between gap-3 py-3 text-left focus-visible:outline-2 pointer-coarse:min-h-11"
                >
                  <span className="type-ui text-heading min-w-0 break-words">
                    {effect.name}
                  </span>
                  <span className="type-small text-muted shrink-0 text-right">
                    {SPELL_SOURCE_BOOKS[effect.source] || effect.source}
                    {activeTab === 'diseases' &&
                      'type' in effect &&
                      effect.type && <> · {effect.type}</>}
                  </span>
                </button>
              ))}
              {pickerOptions.length === 0 && search && (
                <p className="type-body text-muted py-8 text-center">
                  No {activeTab === 'diseases' ? 'diseases' : 'conditions'}{' '}
                  found matching &quot;{search}&quot;
                </p>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ConditionDetailsModal
        isOpen={detailsOpen}
        onClose={() => {
          setDetailsOpen(false);
          setSelectedCondition(null);
          setSelectedDisease(null);
        }}
        condition={selectedCondition ?? undefined}
        disease={selectedDisease ?? undefined}
        onUpdateNotes={notes => {
          if (selectedCondition) {
            updateCondition(selectedCondition.id, { notes });
            setSelectedCondition({ ...selectedCondition, notes });
          }
          if (selectedDisease) {
            updateDisease(selectedDisease.id, { notes });
            setSelectedDisease({ ...selectedDisease, notes });
          }
        }}
        onUpdateOnsetTime={onsetTime => {
          if (selectedDisease) {
            updateDisease(selectedDisease.id, { onsetTime });
            setSelectedDisease({ ...selectedDisease, onsetTime });
          }
        }}
      />
    </Section>
  );
}
