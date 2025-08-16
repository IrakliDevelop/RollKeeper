'use client';

import React from 'react';
import { Filter, X, Pin, Tag, Users, Package, Map, FileText } from 'lucide-react';
import { FancySelect } from '@/components/ui/FancySelect';

interface FilterOptions {
  categories: string[];
  tags: string[];
  pinned: boolean | null; // null = all, true = pinned only, false = unpinned only
  sortBy: 'updated' | 'created' | 'title' | 'category';
  sortOrder: 'asc' | 'desc';
}

interface FilterPanelProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCategories: string[];
  availableTags: string[];
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
}

export default function FilterPanel({
  filters,
  onFiltersChange,
  availableCategories,
  availableTags,
  className = '',
  isOpen,
  onToggle
}: FilterPanelProps) {
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'session': return <FileText size={14} className="text-blue-600" />;
      case 'npc': return <Users size={14} className="text-green-600" />;
      case 'item': return <Package size={14} className="text-purple-600" />;
      case 'plot': return <Map size={14} className="text-orange-600" />;
      default: return <FileText size={14} className="text-gray-600" />;
    }
  };

  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      categories: [],
      tags: [],
      pinned: null,
      sortBy: 'updated',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = filters.categories.length > 0 || 
                          filters.tags.length > 0 || 
                          filters.pinned !== null;

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 ${className}`}
      >
        <Filter size={16} />
        Filters
        {hasActiveFilters && (
          <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
            {filters.categories.length + filters.tags.length + (filters.pinned !== null ? 1 : 0)}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg p-4 space-y-4 ${className}`}>
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-600" />
          <h3 className="font-medium text-gray-900">Filters</h3>
          {hasActiveFilters && (
            <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
              {filters.categories.length + filters.tags.length + (filters.pinned !== null ? 1 : 0)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear all
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Categories Filter */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Categories</h4>
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryToggle(category)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                filters.categories.includes(category)
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {getCategoryIcon(category)}
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tags Filter */}
      {availableTags.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Tags</h4>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {availableTags.slice(0, 20).map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                  filters.tags.includes(tag)
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Tag size={10} />
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pinned Filter */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Status</h4>
        <div className="flex gap-2">
          <button
            onClick={() => onFiltersChange({ ...filters, pinned: null })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filters.pinned === null
                ? 'bg-gray-200 text-gray-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Notes
          </button>
          <button
            onClick={() => onFiltersChange({ ...filters, pinned: true })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filters.pinned === true
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Pin size={12} />
            Pinned Only
          </button>
        </div>
      </div>

      {/* Sort Options */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Sort by</h4>
        <div className="grid grid-cols-1 gap-3">
          <FancySelect
            value={filters.sortBy}
            onChange={(value) => onFiltersChange({ 
              ...filters, 
              sortBy: value as FilterOptions['sortBy'] 
            })}
            options={[
              { value: 'updated', label: 'Last Updated', description: 'Most recently modified notes first' },
              { value: 'created', label: 'Date Created', description: 'Newest notes first' },
              { value: 'title', label: 'Title', description: 'Alphabetical order' },
              { value: 'category', label: 'Category', description: 'Group by note type' }
            ]}
            color="slate"
            className="text-sm"
          />
          <FancySelect
            value={filters.sortOrder}
            onChange={(value) => onFiltersChange({ 
              ...filters, 
              sortOrder: value as FilterOptions['sortOrder'] 
            })}
            options={[
              { value: 'desc', label: 'Newest First', description: 'Recent items at the top' },
              { value: 'asc', label: 'Oldest First', description: 'Older items at the top' }
            ]}
            color="slate"
            className="text-sm"
          />
        </div>
      </div>
    </div>
  );
}

export type { FilterOptions };
