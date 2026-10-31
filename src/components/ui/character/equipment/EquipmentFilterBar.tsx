'use client';

import React, { useState } from 'react';
import type { EquipmentFilters } from '@/hooks/useEquipmentFilters';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Button } from '@/components/ui/forms/button';
import { SlidersHorizontal, X } from 'lucide-react';

export interface FilterConfig {
  showAttuned?: boolean;
  showCategory?: boolean;
  showRarity?: boolean;
  showHasCharges?: boolean;
  categoryOptions?: string[];
}

interface EquipmentFilterBarProps {
  filters: EquipmentFilters;
  onFilterChange: <K extends keyof EquipmentFilters>(
    key: K,
    value: EquipmentFilters[K]
  ) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  config: FilterConfig;
}

const RARITY_OPTIONS = [
  'all',
  'common',
  'uncommon',
  'rare',
  'very rare',
  'legendary',
  'artifact',
];

export function getEquipmentEmptyText(
  kind: 'weapons' | 'magic items' | 'armor',
  filters: EquipmentFilters
): string {
  const hasFieldFilter =
    filters.equipped !== 'all' ||
    filters.attuned !== 'all' ||
    filters.category !== 'all' ||
    filters.rarity !== 'all' ||
    filters.hasCharges !== 'all';
  const verb = kind === 'armor' ? 'matches' : 'match';
  if (hasFieldFilter) return `No ${kind} ${verb} your filters.`;
  return `No ${kind} ${verb} “${filters.search.trim()}”.`;
}

export function EquipmentFilterBar({
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
  config,
}: EquipmentFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = Object.entries(filters).filter(
    ([key, value]) => value !== (key === 'search' ? '' : 'all')
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-[1_1_12rem]">
          <Input
            value={filters.search}
            onChange={e => onFilterChange('search', e.target.value)}
            placeholder="Search by name"
            aria-label="Search by name"
            className="h-9 text-sm"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Filters"
          aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}
          className="h-9"
        >
          <SlidersHorizontal size={14} aria-hidden="true" className="mr-1" />
          Filters
          {activeCount > 0 && (
            <span aria-hidden="true" className="text-muted ml-1">
              {activeCount}
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button onClick={onReset} variant="ghost" size="sm" className="h-9">
            <X size={14} aria-hidden="true" className="mr-1" />
            Clear filters
          </Button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[130px]">
            <SelectField
              triggerProps={{ 'aria-label': 'Equipped' }}
              value={filters.equipped}
              onValueChange={v =>
                onFilterChange('equipped', v as EquipmentFilters['equipped'])
              }
            >
              <SelectItem value="all">Equipped or not</SelectItem>
              <SelectItem value="equipped">Equipped</SelectItem>
              <SelectItem value="unequipped">Not equipped</SelectItem>
            </SelectField>
          </div>

          {config.showAttuned && (
            <div className="w-[130px]">
              <SelectField
                triggerProps={{ 'aria-label': 'Attunement' }}
                value={filters.attuned}
                onValueChange={v =>
                  onFilterChange('attuned', v as EquipmentFilters['attuned'])
                }
              >
                <SelectItem value="all">Attuned or not</SelectItem>
                <SelectItem value="attuned">Attuned</SelectItem>
                <SelectItem value="unattuned">Not attuned</SelectItem>
              </SelectField>
            </div>
          )}

          {config.showCategory && config.categoryOptions && (
            <div className="w-[130px]">
              <SelectField
                triggerProps={{ 'aria-label': 'Category' }}
                value={filters.category}
                onValueChange={v => onFilterChange('category', v)}
              >
                {config.categoryOptions.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {opt === 'all'
                      ? 'All categories'
                      : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
          )}

          {config.showRarity && (
            <div className="w-[130px]">
              <SelectField
                triggerProps={{ 'aria-label': 'Rarity' }}
                value={filters.rarity}
                onValueChange={v => onFilterChange('rarity', v)}
              >
                {RARITY_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {opt === 'all'
                      ? 'All rarities'
                      : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </SelectItem>
                ))}
              </SelectField>
            </div>
          )}

          {config.showHasCharges && (
            <div className="w-[140px]">
              <SelectField
                triggerProps={{ 'aria-label': 'Charges' }}
                value={filters.hasCharges}
                onValueChange={v =>
                  onFilterChange(
                    'hasCharges',
                    v as EquipmentFilters['hasCharges']
                  )
                }
              >
                <SelectItem value="all">With or without charges</SelectItem>
                <SelectItem value="with">With charges</SelectItem>
                <SelectItem value="without">Without charges</SelectItem>
              </SelectField>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
