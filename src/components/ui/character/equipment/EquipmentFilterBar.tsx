'use client';

import React from 'react';
import type { EquipmentFilters } from '@/hooks/useEquipmentFilters';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { Button } from '@/components/ui/forms/button';
import { X } from 'lucide-react';

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

export function EquipmentFilterBar({
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
  config,
}: EquipmentFilterBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[140px] flex-1">
        <Input
          value={filters.search}
          onChange={e => onFilterChange('search', e.target.value)}
          placeholder="Search by name..."
          className="h-9 text-sm"
        />
      </div>

      <div className="w-[130px]">
        <SelectField
          value={filters.equipped}
          onValueChange={v =>
            onFilterChange('equipped', v as EquipmentFilters['equipped'])
          }
        >
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="equipped">Equipped</SelectItem>
          <SelectItem value="unequipped">Unequipped</SelectItem>
        </SelectField>
      </div>

      {config.showAttuned && (
        <div className="w-[130px]">
          <SelectField
            value={filters.attuned}
            onValueChange={v =>
              onFilterChange('attuned', v as EquipmentFilters['attuned'])
            }
          >
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="attuned">Attuned</SelectItem>
            <SelectItem value="unattuned">Unattuned</SelectItem>
          </SelectField>
        </div>
      )}

      {config.showCategory && config.categoryOptions && (
        <div className="w-[130px]">
          <SelectField
            value={filters.category}
            onValueChange={v => onFilterChange('category', v)}
          >
            {config.categoryOptions.map(opt => (
              <SelectItem key={opt} value={opt}>
                {opt === 'all'
                  ? 'All Categories'
                  : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </SelectItem>
            ))}
          </SelectField>
        </div>
      )}

      {config.showRarity && (
        <div className="w-[130px]">
          <SelectField
            value={filters.rarity}
            onValueChange={v => onFilterChange('rarity', v)}
          >
            {RARITY_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>
                {opt === 'all'
                  ? 'All Rarities'
                  : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </SelectItem>
            ))}
          </SelectField>
        </div>
      )}

      {config.showHasCharges && (
        <div className="w-[140px]">
          <SelectField
            value={filters.hasCharges}
            onValueChange={v =>
              onFilterChange('hasCharges', v as EquipmentFilters['hasCharges'])
            }
          >
            <SelectItem value="all">All Charges</SelectItem>
            <SelectItem value="with">With Charges</SelectItem>
            <SelectItem value="without">Without Charges</SelectItem>
          </SelectField>
        </div>
      )}

      {hasActiveFilters && (
        <Button onClick={onReset} variant="ghost" size="sm" className="h-9">
          <X size={14} className="mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
