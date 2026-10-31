'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { InventoryItem } from '@/types/character';
import { Plus, X, List, Grid3X3 } from 'lucide-react';
import { formatCurrencyFromCopper } from '@/utils/currency';
import DragDropList from '@/components/ui/layout/DragDropList';
import { Section } from '@/components/ui/layout/section';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import {
  ItemCard,
  ItemForm,
  ItemViewModal,
  initialInventoryFormData,
  type InventoryFormData,
} from '../../ui/game/inventory';
import { useItemsData } from '@/hooks/useItemsData';
import { useMagicItemsData } from '@/hooks/useMagicItemsData';

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

export function inventoryLocationKey(scopeId: string, location: string) {
  return `inventory-location:${encodeURIComponent(scopeId)}:${encodeURIComponent(location)}`;
}

interface InventoryManagerProps {
  items: InventoryItem[];
  onAddItem?: (
    item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateItem?: (id: string, updates: Partial<InventoryItem>) => void;
  onDeleteItem?: (id: string) => void;
  onQuantityChange?: (id: string, quantity: number) => void;
  onReorderItems?: (sourceIndex: number, destinationIndex: number) => void;
  onSendItem?: (item: InventoryItem) => void;
  overrideTotalWeight?: number;
  overrideTotalValue?: number;
  /** Show sheet-wide totals semantics only when the sheet supplies totals. */
  sheetSummary?: boolean;
  /** Stable entity ID for persisted per-device location disclosure. */
  locationScopeId?: string;
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
  onSendItem,
  overrideTotalWeight,
  overrideTotalValue,
  sheetSummary = false,
  locationScopeId,
  readonly = false,
  compact = false,
  hideAddButton = false,
  hideFilters = false,
  hideLocations = false,
  showOnlyLocation,
  maxItemsToShow,
  className = '',
}: InventoryManagerProps) {
  const { items: databaseItems, loading: itemsLoading } = useItemsData();
  const { items: databaseMagicItems } = useMagicItemsData();
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState<InventoryFormData>(
    initialInventoryFormData
  );
  const [filterLocation, setFilterLocation] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [compactView, setCompactView] = useState(true);
  const [collapsedLocations, setCollapsedLocations] = useState<Set<string>>(
    new Set()
  );
  const [pendingDeleteFocusId, setPendingDeleteFocusId] = useState<
    string | null
  >(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (
      pendingDeleteFocusId &&
      !items.some(item => item.id === pendingDeleteFocusId)
    ) {
      addButtonRef.current?.focus();
      setPendingDeleteFocusId(null);
    }
  }, [items, pendingDeleteFocusId]);

  const allLocations = useMemo(
    () =>
      [
        ...new Set([
          ...DEFAULT_LOCATIONS,
          ...items
            .map(item => item.location)
            .filter((loc): loc is string => Boolean(loc)),
        ]),
      ].sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (showOnlyLocation) {
      result = result.filter(item =>
        showOnlyLocation === 'Unassigned'
          ? !item.location
          : item.location === showOnlyLocation
      );
    } else {
      result = result.filter(
        item =>
          (filterLocation === 'all' ||
            (filterLocation === 'Unassigned' && !item.location) ||
            item.location === filterLocation) &&
          (filterCategory === 'all' || item.category === filterCategory) &&
          (!searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()) ||
            (item.tags ?? []).some(tag =>
              tag.toLowerCase().includes(searchQuery.toLowerCase())
            ))
      );
    }
    if (maxItemsToShow && result.length > maxItemsToShow)
      result = result.slice(0, maxItemsToShow);
    return result;
  }, [
    items,
    filterLocation,
    filterCategory,
    searchQuery,
    showOnlyLocation,
    maxItemsToShow,
  ]);

  const itemsByLocation = useMemo(() => {
    const grouped: Record<string, InventoryItem[]> = {};
    for (const item of filteredItems) {
      const location = item.location || 'Unassigned';
      (grouped[location] ??= []).push(item);
    }
    return grouped;
  }, [filteredItems]);

  const stats = useMemo(
    () => ({
      totalItems: filteredItems.reduce((sum, item) => sum + item.quantity, 0),
      totalWeight:
        overrideTotalWeight ??
        filteredItems.reduce(
          (sum, item) => sum + (item.weight || 0) * item.quantity,
          0
        ),
      totalValue:
        overrideTotalValue ??
        filteredItems.reduce(
          (sum, item) => sum + (item.value || 0) * item.quantity,
          0
        ),
    }),
    [filteredItems, overrideTotalWeight, overrideTotalValue]
  );

  const activeFilterCount =
    Number(Boolean(searchQuery)) +
    Number(filterLocation !== 'all') +
    Number(filterCategory !== 'all');
  const clearFilters = () => {
    setSearchQuery('');
    setFilterLocation('all');
    setFilterCategory('all');
  };
  const resetForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    setFormData(initialInventoryFormData);
  };
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
      tags: item.tags ?? [],
    });
    setShowItemForm(true);
  };
  const handleFormSubmit = (data: InventoryFormData) => {
    if (editingItem && onUpdateItem) onUpdateItem(editingItem.id, data);
    else if (onAddItem) onAddItem(data);
    resetForm();
  };
  const toggleLocalLocation = (location: string, collapsed: boolean) => {
    setCollapsedLocations(previous => {
      const next = new Set(previous);
      if (collapsed) next.add(location);
      else next.delete(location);
      return next;
    });
  };
  const renderItem = (item: InventoryItem) => (
    <ItemCard
      item={item}
      onView={setViewingItem}
      onEdit={readonly || !onUpdateItem ? undefined : handleEditItem}
      onDelete={
        readonly || !onDeleteItem
          ? undefined
          : () => {
              void confirmDialog({
                title: `Delete ${item.name}?`,
                confirmLabel: 'Delete item',
                cancelLabel: 'Cancel',
                tone: 'danger',
              }).then(confirmed => {
                if (confirmed) {
                  setPendingDeleteFocusId(item.id);
                  onDeleteItem(item.id);
                }
              });
            }
      }
      onQuantityChange={
        readonly || !onQuantityChange
          ? undefined
          : quantity => onQuantityChange(item.id, quantity)
      }
      onSend={onSendItem}
      onUse={
        readonly || !onQuantityChange || item.category !== 'consumable'
          ? undefined
          : () => onQuantityChange(item.id, Math.max(0, item.quantity - 1))
      }
      compact={compact || compactView}
    />
  );

  return (
    <Section
      heading="Items"
      className={className}
      trailing={
        <div className="flex items-center gap-2">
          {!compact && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Show item details"
              aria-pressed={!compactView}
              onClick={() => setCompactView(value => !value)}
            >
              {compactView ? (
                <List size={18} aria-hidden="true" />
              ) : (
                <Grid3X3 size={18} aria-hidden="true" />
              )}
            </Button>
          )}
          {!readonly && !hideAddButton && onAddItem && (
            <Button
              ref={addButtonRef}
              type="button"
              onClick={() => {
                setEditingItem(null);
                setFormData(initialInventoryFormData);
                setShowItemForm(true);
              }}
              variant="primary"
              size="sm"
              leftIcon={<Plus size={16} />}
            >
              Add item
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-heading type-subheading">{stats.totalItems}</p>
            <p className="text-muted type-small">
              {activeFilterCount ? 'Matching quantity' : 'Total quantity'}
            </p>
          </div>
          <div>
            <p className="text-heading type-subheading">
              {stats.totalWeight.toFixed(1)}
            </p>
            <p className="text-muted type-small">Weight (lb)</p>
          </div>
          <div>
            <p className="text-heading type-subheading">
              {formatCurrencyFromCopper(stats.totalValue)}
            </p>
            <p className="text-muted type-small">Value</p>
          </div>
        </div>
        {sheetSummary && (
          <p className="text-muted type-small">
            Weight and value include all weapons, armor and items, regardless of
            filters. Weight also includes coins.
          </p>
        )}

        {!hideFilters && !showOnlyLocation && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Input
                type="search"
                placeholder="Search items"
                aria-label="Search items"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="min-h-10 text-sm"
                wrapperClassName="min-w-0 flex-[1_1_12rem]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Filters"
                aria-expanded={showFilters}
                onClick={() => setShowFilters(value => !value)}
              >
                Filters{' '}
                {activeFilterCount > 0 && (
                  <span aria-hidden="true" className="text-muted">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  <X size={14} aria-hidden="true" />
                  Clear filters
                </Button>
              )}
            </div>
            {showFilters && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SelectField
                  value={filterLocation}
                  onValueChange={setFilterLocation}
                  triggerProps={{ 'aria-label': 'Location' }}
                >
                  <SelectItem value="all">All locations</SelectItem>
                  {allLocations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                </SelectField>
                <SelectField
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                  triggerProps={{ 'aria-label': 'Category' }}
                >
                  <SelectItem value="all">All categories</SelectItem>
                  {ITEM_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectField>
              </div>
            )}
          </div>
        )}

        {filteredItems.length > 0 ? (
          hideLocations ? (
            <DragDropList
              items={filteredItems}
              onReorder={onReorderItems || (() => {})}
              keyExtractor={item => item.id}
              className="space-y-1"
              showDragHandle={!readonly && !!onReorderItems}
              dragHandlePosition="left"
              renderItem={item => renderItem(item)}
            />
          ) : (
            <div className="space-y-5">
              {Object.entries(itemsByLocation).map(
                ([location, locationItems]) => (
                  <Section
                    key={location}
                    heading={location}
                    level={3}
                    collapsible={
                      locationScopeId
                        ? inventoryLocationKey(locationScopeId, location)
                        : undefined
                    }
                    collapsed={
                      !locationScopeId
                        ? collapsedLocations.has(location)
                        : undefined
                    }
                    onCollapsedChange={
                      !locationScopeId
                        ? collapsed => toggleLocalLocation(location, collapsed)
                        : undefined
                    }
                    trailing={
                      <span className="text-muted text-sm">
                        {locationItems.length}
                      </span>
                    }
                  >
                    <div className="space-y-1">
                      {locationItems.map(item => (
                        <div key={item.id}>{renderItem(item)}</div>
                      ))}
                    </div>
                  </Section>
                )
              )}
            </div>
          )
        ) : (
          <div className="text-muted py-10 text-center">
            <p className="text-heading font-medium">
              {activeFilterCount
                ? filterLocation !== 'all' || filterCategory !== 'all'
                  ? 'No items match your search or filters.'
                  : `No items match “${searchQuery.trim()}”.`
                : 'Add your first item'}
            </p>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>

      <ItemForm
        isOpen={showItemForm}
        onClose={resetForm}
        onSubmit={handleFormSubmit}
        initialData={formData}
        availableLocations={allLocations}
        isEditing={!!editingItem}
        databaseItems={databaseItems}
        databaseMagicItems={databaseMagicItems}
        itemsLoading={itemsLoading}
      />
      <ItemViewModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onEdit={readonly || !onUpdateItem ? undefined : handleEditItem}
      />
    </Section>
  );
}
