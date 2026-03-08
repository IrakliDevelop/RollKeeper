'use client';

import React, { useState, useMemo } from 'react';
import { InventoryItem } from '@/types/character';
import {
  Plus,
  Package,
  Filter,
  MapPin,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  List,
  Grid3X3,
} from 'lucide-react';
import { formatCurrencyFromCopper } from '@/utils/currency';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  ItemCard,
  ItemForm,
  ItemViewModal,
  initialInventoryFormData,
  type InventoryFormData,
} from '../../ui/game/inventory';

const ITEM_CATEGORIES = [
  'weapon',
  'armor',
  'tool',
  'consumable',
  'treasure',
  'misc',
];

const DEFAULT_LOCATIONS = [
  'Backpack',
  'Belt',
  'Pocket',
  'Bag of Holding',
  'Saddlebags',
  'Chest',
  'Wagon',
  'On Person',
  'Left Behind',
];

interface InventoryManagerProps {
  items: InventoryItem[];
  onAddItem?: (
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateItem?: (id: string, updates: Partial<InventoryItem>) => void;
  onDeleteItem?: (id: string) => void;
  onQuantityChange?: (id: string, quantity: number) => void;
  onReorderItems?: (sourceIndex: number, destinationIndex: number) => void;

  // Display options
  readonly?: boolean;
  compact?: boolean;
  hideAddButton?: boolean;
  hideFilters?: boolean;
  hideLocations?: boolean;
  showOnlyLocation?: string;
  maxItemsToShow?: number;

  className?: string;
}

export function InventoryManager({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onQuantityChange,
  onReorderItems,
  readonly = false,
  compact = false,
  hideAddButton = false,
  hideFilters = false,
  hideLocations = false,
  showOnlyLocation,
  maxItemsToShow,
  className = '',
}: InventoryManagerProps) {
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<InventoryFormData>(
    initialInventoryFormData
  );
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [compactView, setCompactView] = useState(true);
  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(
    new Set()
  );

  const effectiveCompact = compact || compactView;

  // Get all unique locations from items
  const allLocations = useMemo(() => {
    return [
      ...new Set([
        ...DEFAULT_LOCATIONS,
        ...items
          .map(item => item.location)
          .filter((loc): loc is string => Boolean(loc)),
      ]),
    ].sort();
  }, [items]);

  // Filter items based on selected filters and display options
  const filteredItems = useMemo(() => {
    let result = items;

    if (showOnlyLocation) {
      result = result.filter(item =>
        showOnlyLocation === 'Unassigned'
          ? !item.location || item.location === null
          : item.location === showOnlyLocation
      );
    } else {
      result = result.filter(item => {
        const locationMatch =
          filterLocation === 'all' ||
          (filterLocation === 'Unassigned' &&
            (!item.location || item.location === null)) ||
          item.location === filterLocation;

        const categoryMatch =
          filterCategory === 'all' || item.category === filterCategory;

        const searchMatch =
          !searchQuery ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.tags.some(tag =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          );

        return locationMatch && categoryMatch && searchMatch;
      });
    }

    if (maxItemsToShow && result.length > maxItemsToShow) {
      result = result.slice(0, maxItemsToShow);
    }

    return result;
  }, [
    items,
    filterLocation,
    filterCategory,
    searchQuery,
    showOnlyLocation,
    maxItemsToShow,
  ]);

  // Group items by location
  const itemsByLocation = useMemo(() => {
    const grouped: Record<string, InventoryItem[]> = {};

    filteredItems.forEach(item => {
      const location = item.location || 'Unassigned';
      if (!grouped[location]) {
        grouped[location] = [];
      }
      grouped[location].push(item);
    });

    return grouped;
  }, [filteredItems]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalItems = filteredItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const totalWeight = filteredItems.reduce(
      (sum, item) => sum + (item.weight || 0) * item.quantity,
      0
    );
    const totalValue = filteredItems.reduce(
      (sum, item) => sum + (item.value || 0) * item.quantity,
      0
    );

    return { totalItems, totalWeight, totalValue };
  }, [filteredItems]);

  const handleEditItem = (item: InventoryItem) => {
    setViewingItem(null);
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      location: item.location || 'Backpack',
      rarity: item.rarity,
      type: item.type,
      quantity: item.quantity,
      weight: item.weight,
      value: item.value,
      description: item.description || '',
      tags: item.tags,
    });
    setShowItemForm(true);
  };

  const handleFormSubmit = (data: InventoryFormData) => {
    if (editingItem && onUpdateItem) {
      onUpdateItem(editingItem.id, data);
    } else if (onAddItem) {
      onAddItem(data);
    }
    resetForm();
  };

  const resetForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setFormData(initialInventoryFormData);
  };

  const toggleLocationCollapse = (location: string) => {
    setCollapsedLocations(prev => {
      const next = new Set(prev);
      if (next.has(location)) {
        next.delete(location);
      } else {
        next.add(location);
      }
      return next;
    });
  };

  const advancedFilterCount = [
    filterLocation !== 'all' ? 1 : 0,
    filterCategory !== 'all' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const renderItemCard = (item: InventoryItem) => (
    <ItemCard
      item={item}
      onView={setViewingItem}
      onEdit={readonly || !onUpdateItem ? undefined : handleEditItem}
      onDelete={
        readonly || !onDeleteItem ? undefined : () => onDeleteItem(item.id)
      }
      onQuantityChange={
        readonly || !onQuantityChange
          ? undefined
          : (quantity: number) => onQuantityChange(item.id, quantity)
      }
      onUse={
        readonly || !onQuantityChange || item.category !== 'consumable'
          ? undefined
          : () => onQuantityChange(item.id, Math.max(0, item.quantity - 1))
      }
      compact={effectiveCompact}
    />
  );

  return (
    <div
      className={`border-divider bg-surface-raised rounded-lg border-2 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="border-divider from-surface-secondary to-surface-inset border-b-2 bg-gradient-to-r p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-heading flex items-center gap-2 text-xl font-bold">
            <Package className="h-6 w-6 text-purple-600" />
            {effectiveCompact ? 'Inventory' : 'Inventory & Equipment'}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="md">
              {filteredItems.length} items
            </Badge>
            {!compact && (
              <Button
                onClick={() => setCompactView(!compactView)}
                variant={compactView ? 'primary' : 'ghost'}
                size="sm"
                title={
                  compactView
                    ? 'Switch to detailed view'
                    : 'Switch to compact view'
                }
                className={
                  compactView ? 'bg-purple-600 hover:bg-purple-700' : ''
                }
              >
                {compactView ? <List size={18} /> : <Grid3X3 size={18} />}
              </Button>
            )}
            {!readonly && !hideAddButton && onAddItem && (
              <Button
                onClick={() => setShowItemForm(true)}
                variant="primary"
                size="sm"
                leftIcon={<Plus size={16} />}
                className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
              >
                Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border-accent-purple-border from-accent-purple-bg to-accent-purple-bg-strong rounded-lg border-2 bg-gradient-to-r p-3 text-center">
            <div className="text-accent-purple-text text-2xl font-bold">
              {stats.totalItems}
            </div>
            <div className="text-accent-purple-text-muted text-xs font-medium">
              Total Items
            </div>
          </div>
          <div className="border-accent-blue-border from-accent-blue-bg to-accent-indigo-bg rounded-lg border-2 bg-gradient-to-r p-3 text-center">
            <div className="text-accent-blue-text text-2xl font-bold">
              {stats.totalWeight.toFixed(1)}
            </div>
            <div className="text-accent-blue-text-muted text-xs font-medium">
              lbs
            </div>
          </div>
          <div className="border-accent-amber-border from-accent-amber-bg to-accent-amber-bg-strong rounded-lg border-2 bg-gradient-to-r p-3 text-center">
            <div className="text-accent-amber-text text-xl font-bold">
              {formatCurrencyFromCopper(stats.totalValue)}
            </div>
            <div className="text-accent-amber-text-muted text-xs font-medium">
              Total Value
            </div>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      {!hideFilters && !showOnlyLocation && (
        <div className="border-divider bg-surface-secondary border-b-2 p-4">
          {/* Always-visible search */}
          <div className="relative">
            <Search className="text-muted absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="border-divider bg-surface-raised text-heading focus:border-accent-purple-border focus:ring-accent-purple-bg w-full rounded-lg border-2 py-2 pr-10 pl-10 text-sm transition-colors focus:ring-2 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-muted hover:text-body absolute top-1/2 right-3 -translate-y-1/2"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Advanced filters toggle */}
          <div className="mt-3 flex items-center justify-between">
            <h3 className="text-heading flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
              <Filter className="h-4 w-4" />
              Advanced Filters
              {advancedFilterCount > 0 && (
                <Badge variant="primary" size="sm">
                  {advancedFilterCount}
                </Badge>
              )}
            </h3>
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="ghost"
              size="xs"
            >
              {showFilters ? 'Hide' : 'Show'}
            </Button>
          </div>

          {showFilters && (
            <>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-body mb-2 flex items-center gap-1 text-sm font-medium">
                    <MapPin className="h-3 w-3" />
                    Location
                  </label>
                  <SelectField
                    value={filterLocation}
                    onValueChange={setFilterLocation}
                  >
                    <SelectItem value="all">All Locations</SelectItem>
                    {allLocations.map(location => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                  </SelectField>
                </div>

                <div>
                  <label className="text-body mb-2 flex items-center gap-1 text-sm font-medium">
                    <Package className="h-3 w-3" />
                    Category
                  </label>
                  <SelectField
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                  >
                    <SelectItem value="all">All Categories</SelectItem>
                    {ITEM_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectField>
                </div>
              </div>

              {advancedFilterCount > 0 && (
                <Button
                  onClick={() => {
                    setFilterLocation('all');
                    setFilterCategory('all');
                  }}
                  variant="ghost"
                  size="sm"
                  leftIcon={<X size={14} />}
                  className="mt-3"
                >
                  Clear Filters
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Items Display */}
      <div className="p-6">
        {filteredItems.length > 0 ? (
          hideLocations ? (
            <DragDropList
              items={filteredItems}
              onReorder={onReorderItems || (() => {})}
              keyExtractor={item => item.id}
              className="space-y-3"
              showDragHandle={!readonly && !!onReorderItems}
              dragHandlePosition="left"
              renderItem={item => renderItemCard(item)}
            />
          ) : (
            <div className="space-y-4">
              {Object.entries(itemsByLocation).map(
                ([location, locationItems]) => {
                  const isCollapsed = collapsedLocations.has(location);

                  return (
                    <div
                      key={location}
                      className="border-divider bg-surface-raised rounded-lg border-2"
                    >
                      <button
                        onClick={() => toggleLocationCollapse(location)}
                        className="hover:bg-surface-hover flex w-full items-center justify-between p-4 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4 text-purple-600" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-purple-600" />
                          )}
                          <MapPin className="h-4 w-4 text-purple-600" />
                          <h4 className="text-heading font-bold">{location}</h4>
                          <Badge variant="secondary" size="sm">
                            {locationItems.length}
                          </Badge>
                        </div>
                        <div className="text-muted text-xs">
                          {isCollapsed
                            ? 'Click to expand'
                            : 'Click to collapse'}
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="space-y-3 p-4 pt-0">
                          {locationItems.map(item => (
                            <React.Fragment key={item.id}>
                              {renderItemCard(item)}
                            </React.Fragment>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )
        ) : (
          <div className="border-border-secondary bg-surface-inset rounded-lg border-2 border-dashed py-12 text-center">
            <Package className="text-muted mx-auto mb-3 h-12 w-12" />
            <p className="text-body font-medium">No items found</p>
            <p className="text-muted mt-1 text-sm">
              {advancedFilterCount > 0 || searchQuery
                ? 'Try adjusting your filters or add new items'
                : 'Add items to track your equipment and supplies'}
            </p>
          </div>
        )}
      </div>

      {/* Item Form Modal */}
      <ItemForm
        isOpen={showItemForm}
        onClose={resetForm}
        onSubmit={handleFormSubmit}
        initialData={formData}
        availableLocations={allLocations}
        isEditing={!!editingItem}
      />

      {/* Item View Modal */}
      <ItemViewModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onEdit={readonly || !onUpdateItem ? undefined : handleEditItem}
      />
    </div>
  );
}
