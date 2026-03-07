'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Timer,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { ToolProficiency, ToolProficiencyLevel } from '@/types/character';
import { useToolsData } from '@/hooks/useToolsData';
import { ToolCategoryDef } from '@/utils/toolProficiencyData';

interface ToolProficienciesSectionProps {
  toolProficiencies: ToolProficiency[];
  proficiencyBonus: number;
  onAddToolProficiency: (
    tool: Omit<ToolProficiency, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateToolProficiency: (
    id: string,
    updates: Partial<ToolProficiency>
  ) => void;
  onDeleteToolProficiency: (id: string) => void;
}

function getProficiencyModifier(
  level: ToolProficiencyLevel,
  bonus: number
): string {
  if (level === 'expertise') return `+${bonus * 2}`;
  if (level === 'proficient') return `+${bonus}`;
  return '';
}

function ToolRow({
  name,
  proficiency,
  proficiencyBonus,
  onToggle,
  onCycleLevel,
  onToggleTemporary,
  onDelete,
  isCustom,
}: {
  name: string;
  proficiency: ToolProficiency | undefined;
  proficiencyBonus: number;
  onToggle: () => void;
  onCycleLevel: () => void;
  onToggleTemporary: () => void;
  onDelete?: () => void;
  isCustom?: boolean;
}) {
  const isActive = !!proficiency && proficiency.proficiencyLevel !== 'none';
  const level = proficiency?.proficiencyLevel;
  const isTemporary = proficiency?.isTemporary;

  return (
    <div
      className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
        isActive
          ? isTemporary
            ? 'bg-accent-amber-bg border-accent-amber-border border border-dashed'
            : 'bg-accent-indigo-bg'
          : 'hover:bg-surface-hover'
      }`}
    >
      <button
        onClick={onToggle}
        className="flex shrink-0 items-center justify-center"
        title={isActive ? 'Remove proficiency' : 'Add proficiency'}
      >
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
            isActive
              ? level === 'expertise'
                ? 'border-purple-500 bg-purple-500'
                : 'border-blue-500 bg-blue-500'
              : 'border-border-secondary bg-surface-raised hover:border-border-primary'
          }`}
        >
          {isActive && <div className="h-2 w-2 rounded-full bg-white" />}
        </div>
      </button>

      <span
        className={`flex-1 text-sm ${
          isActive ? 'text-heading font-medium' : 'text-body'
        }`}
      >
        {name}
      </span>

      {isActive && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleTemporary}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all hover:scale-105 ${
              isTemporary
                ? 'border-amber-400 bg-amber-500 text-white shadow-sm'
                : 'border-divider bg-surface-raised text-muted hover:border-amber-400 hover:text-amber-600'
            }`}
            title={
              isTemporary
                ? 'Remove temporary marker'
                : 'Mark as temporary (swappable on long rest)'
            }
          >
            <Timer className="h-3 w-3" />
            {isTemporary ? 'Temp' : 'Temp'}
          </button>
          <button
            onClick={onCycleLevel}
            className={`rounded-full border px-2 py-0.5 text-xs font-bold transition-all hover:scale-105 ${
              level === 'expertise'
                ? 'border-purple-400 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                : 'border-blue-400 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
            }`}
            title="Click to cycle proficiency level"
          >
            {level === 'expertise' ? 'Expert' : 'Prof.'}
            <span className="ml-1 font-mono">
              {getProficiencyModifier(level!, proficiencyBonus)}
            </span>
          </button>
          {isCustom && onDelete && (
            <button
              onClick={onDelete}
              className="text-muted hover:text-accent-red-text hover:bg-accent-red-bg rounded p-0.5 opacity-100 transition-colors [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
              title="Remove custom tool"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CategorySection({
  category,
  proficiencyMap,
  proficiencyBonus,
  onAdd,
  onUpdate,
  onDelete,
  defaultExpanded = false,
}: {
  category: ToolCategoryDef;
  proficiencyMap: Map<string, ToolProficiency>;
  proficiencyBonus: number;
  onAdd: (name: string) => void;
  onUpdate: (id: string, updates: Partial<ToolProficiency>) => void;
  onDelete: (id: string) => void;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const activeCount = category.items.filter(name =>
    proficiencyMap.has(name.toLowerCase())
  ).length;

  return (
    <div className="border-divider overflow-hidden rounded-lg border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="hover:bg-surface-hover flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="text-muted h-4 w-4" />
          ) : (
            <ChevronRight className="text-muted h-4 w-4" />
          )}
          <span className="text-heading text-sm font-semibold tracking-wide uppercase">
            {category.label}
          </span>
        </div>
        {activeCount > 0 && (
          <span className="bg-accent-indigo-bg-strong text-accent-indigo-text rounded-full px-2 py-0.5 text-xs font-medium">
            {activeCount}
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="border-divider border-t px-2 py-1">
          {category.items.map(toolName => {
            const prof = proficiencyMap.get(toolName.toLowerCase());
            return (
              <ToolRow
                key={toolName}
                name={toolName}
                proficiency={prof}
                proficiencyBonus={proficiencyBonus}
                onToggle={() => {
                  if (prof) {
                    onDelete(prof.id);
                  } else {
                    onAdd(toolName);
                  }
                }}
                onCycleLevel={() => {
                  if (!prof) return;
                  const next: ToolProficiencyLevel =
                    prof.proficiencyLevel === 'proficient'
                      ? 'expertise'
                      : 'proficient';
                  onUpdate(prof.id, { proficiencyLevel: next });
                }}
                onToggleTemporary={() => {
                  if (!prof) return;
                  onUpdate(prof.id, { isTemporary: !prof.isTemporary });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ToolProficienciesSection({
  toolProficiencies,
  proficiencyBonus,
  onAddToolProficiency,
  onUpdateToolProficiency,
  onDeleteToolProficiency,
}: ToolProficienciesSectionProps) {
  const { categories, loading } = useToolsData();
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');

  // Map existing proficiencies by lowercase name for O(1) lookup
  const proficiencyMap = useMemo(() => {
    const map = new Map<string, ToolProficiency>();
    for (const tp of toolProficiencies) {
      map.set(tp.name.toLowerCase().trim(), tp);
    }
    return map;
  }, [toolProficiencies]);

  // Find custom tools: existing proficiencies that don't match any reference item
  const customTools = useMemo(() => {
    const allReferenceNames = new Set(
      categories.flatMap(c => c.items.map(i => i.toLowerCase()))
    );
    return toolProficiencies.filter(
      tp => !allReferenceNames.has(tp.name.toLowerCase().trim())
    );
  }, [toolProficiencies, categories]);

  const handleAddCustom = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (proficiencyMap.has(trimmed.toLowerCase())) return;
    onAddToolProficiency({ name: trimmed, proficiencyLevel: 'proficient' });
    setCustomName('');
    setIsAddingCustom(false);
  };

  const activeProficiencies = useMemo(
    () => toolProficiencies.filter(t => t.proficiencyLevel !== 'none'),
    [toolProficiencies]
  );

  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="text-accent-indigo-text-muted h-5 w-5" />
          <span className="text-heading text-lg font-semibold">
            Tool Proficiencies
          </span>
          {activeProficiencies.length > 0 && (
            <span className="bg-accent-indigo-bg-strong text-accent-indigo-text rounded-full px-2.5 py-0.5 text-sm font-medium">
              {activeProficiencies.length}
            </span>
          )}
        </div>
        <Button
          onClick={() => setIsAddingCustom(true)}
          variant="ghost"
          size="xs"
          leftIcon={<Plus className="h-4 w-4" />}
          className="text-accent-indigo-text-muted hover:text-accent-indigo-text"
        >
          Custom
        </Button>
      </div>

      {/* Active proficiencies summary */}
      {activeProficiencies.length > 0 && (
        <div className="border-accent-indigo-border bg-surface-raised space-y-1 rounded-lg border p-2 shadow-sm">
          {activeProficiencies.map(tp => (
            <div
              key={tp.id}
              className={`group/row flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                tp.isTemporary
                  ? 'border-accent-amber-border bg-accent-amber-bg border border-dashed'
                  : 'hover:bg-surface-hover'
              }`}
            >
              <span className="text-heading flex-1 text-sm font-semibold">
                {tp.name}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    onUpdateToolProficiency(tp.id, {
                      isTemporary: !tp.isTemporary,
                    })
                  }
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-all hover:scale-105 ${
                    tp.isTemporary
                      ? 'border-amber-400 bg-amber-500 text-white shadow-sm'
                      : 'border-divider bg-surface-raised text-muted hover:border-amber-400 hover:text-amber-600'
                  }`}
                  title={
                    tp.isTemporary
                      ? 'Remove temporary marker'
                      : 'Mark as temporary (swappable on long rest)'
                  }
                >
                  <Timer className="h-3 w-3" />
                  Temp
                </button>
                <button
                  onClick={() => {
                    const next: ToolProficiencyLevel =
                      tp.proficiencyLevel === 'proficient'
                        ? 'expertise'
                        : 'proficient';
                    onUpdateToolProficiency(tp.id, {
                      proficiencyLevel: next,
                    });
                  }}
                  className={`rounded-full border px-2 py-0.5 text-xs font-bold transition-all hover:scale-105 ${
                    tp.proficiencyLevel === 'expertise'
                      ? 'border-purple-400 bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                      : 'border-blue-400 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm'
                  }`}
                  title="Click to cycle proficiency level"
                >
                  {tp.proficiencyLevel === 'expertise' ? 'Expert' : 'Prof.'}
                  <span className="ml-1 font-mono">
                    {getProficiencyModifier(
                      tp.proficiencyLevel,
                      proficiencyBonus
                    )}
                  </span>
                </button>
                <button
                  onClick={() => onDeleteToolProficiency(tp.id)}
                  className="text-muted hover:text-accent-red-text hover:bg-accent-red-bg rounded p-0.5 opacity-100 transition-colors [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100"
                  title="Remove proficiency"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category lists */}
      {loading ? (
        <div className="text-muted py-8 text-center text-sm">
          Loading tools...
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(category => {
            const hasActive = category.items.some(name =>
              proficiencyMap.has(name.toLowerCase())
            );
            return (
              <CategorySection
                key={category.id}
                category={category}
                proficiencyMap={proficiencyMap}
                proficiencyBonus={proficiencyBonus}
                onAdd={name =>
                  onAddToolProficiency({
                    name,
                    proficiencyLevel: 'proficient',
                  })
                }
                onUpdate={onUpdateToolProficiency}
                onDelete={onDeleteToolProficiency}
                defaultExpanded={false}
              />
            );
          })}
        </div>
      )}

      {/* Custom tools section */}
      {(customTools.length > 0 || isAddingCustom) && (
        <div className="border-divider overflow-hidden rounded-lg border">
          <div className="bg-surface-hover px-4 py-3">
            <span className="text-heading text-sm font-semibold tracking-wide uppercase">
              Custom
            </span>
            {customTools.length > 0 && (
              <span className="bg-accent-amber-bg text-accent-amber-text ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                {customTools.length}
              </span>
            )}
          </div>
          <div className="border-divider border-t px-2 py-1">
            {customTools.map(tp => (
              <ToolRow
                key={tp.id}
                name={tp.name}
                proficiency={tp}
                proficiencyBonus={proficiencyBonus}
                isCustom
                onToggle={() => onDeleteToolProficiency(tp.id)}
                onCycleLevel={() => {
                  const next: ToolProficiencyLevel =
                    tp.proficiencyLevel === 'proficient'
                      ? 'expertise'
                      : 'proficient';
                  onUpdateToolProficiency(tp.id, {
                    proficiencyLevel: next,
                  });
                }}
                onToggleTemporary={() =>
                  onUpdateToolProficiency(tp.id, {
                    isTemporary: !tp.isTemporary,
                  })
                }
                onDelete={() => onDeleteToolProficiency(tp.id)}
              />
            ))}
            {isAddingCustom && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Input
                  type="text"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddCustom();
                    if (e.key === 'Escape') {
                      setIsAddingCustom(false);
                      setCustomName('');
                    }
                  }}
                  placeholder="e.g., Kalimba"
                  className="flex-1"
                  autoFocus
                />
                <Button
                  onClick={handleAddCustom}
                  variant="primary"
                  size="sm"
                  className="bg-accent-indigo-text-muted hover:bg-accent-indigo-text"
                >
                  Add
                </Button>
                <Button
                  onClick={() => {
                    setIsAddingCustom(false);
                    setCustomName('');
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tip */}
      {activeProficiencies.length > 0 && (
        <div className="text-muted px-1 text-xs">
          Click the circle to toggle proficiency. Click the badge to switch
          between Proficient and Expert. Use the{' '}
          <Timer className="inline h-3 w-3" /> icon to mark temporary
          proficiencies (swappable on long rest).
        </div>
      )}
    </div>
  );
}
