'use client';

import React, { useState } from 'react';
import { InventoryItem, MagicItemRarity, MagicItemCategory } from '@/types/character';
import { Plus, Edit2, Trash2, Package, Minus, MapPin, Filter, X } from 'lucide-react';
import { formatCurrencyFromCopper } from '@/utils/currency';
import { inputStyles, selectStyles, labelStyles } from '@/styles/inputs';
import CustomDropdown from '@/components/ui/CustomDropdown';
import DragDropList from '@/components/ui/DragDropList';

const ITEM_CATEGORIES = ['weapon', 'armor', 'tool', 'consumable', 'treasure', 'misc'];

const ITEM_RARITIES: MagicItemRarity[] = [
  'common', 'uncommon', 'rare', 'very rare', 'legendary', 'artifact'
];

const ITEM_TYPES: MagicItemCategory[] = [
  'wondrous', 'armor', 'shield', 'ring', 'staff', 'wand', 'rod', 'scroll', 'potion', 'artifact', 'other'
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
  'Left Behind'
];

const getRarityColor = (rarity?: MagicItemRarity) => {
  if (!rarity) return 'text-gray-600 bg-gray-100';
  
  switch (rarity) {
    case 'common': return 'text-gray-600 bg-gray-100';
    case 'uncommon': return 'text-green-600 bg-green-100';
    case 'rare': return 'text-blue-600 bg-blue-100';
    case 'very rare': return 'text-purple-600 bg-purple-100';
    case 'legendary': return 'text-orange-600 bg-orange-100';
    case 'artifact': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

interface InventoryFormData {
  name: string;
  category: string;
  location: string;
  rarity?: MagicItemRarity;
  type?: MagicItemCategory;
  quantity: number;
  weight?: number;
  value?: number;
  description: string;
  tags: string[];
}

const initialFormData: InventoryFormData = {
  name: '',
  category: 'misc',
  location: 'Backpack',
  rarity: undefined,
  type: undefined,
  quantity: 1,
  weight: undefined,
  value: undefined,
  description: '',
  tags: [],
};

interface InventoryManagerProps {
  items: InventoryItem[];
  onAddItem?: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
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
  className = ''
}: InventoryManagerProps) {
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InventoryFormData>(initialFormData);
  const [tagInput, setTagInput] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [showCustomLocation, setShowCustomLocation] = useState(false);
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Get all unique locations from items
  const allLocations = [...new Set([
    ...DEFAULT_LOCATIONS,
    ...items
      .map(item => item.location)
      .filter(Boolean)
  ])].sort();

  // Prepare dropdown options
  const locationOptions = [
    { value: 'all', label: 'All Locations' },
    ...allLocations.filter((location): location is string => Boolean(location)).map(location => ({ value: location, label: location })),
    { value: 'Unassigned', label: 'Unassigned' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...ITEM_CATEGORIES.map(category => ({ 
      value: category, 
      label: category.charAt(0).toUpperCase() + category.slice(1) 
    }))
  ];

  // Filter items based on selected filters and display options
  let filteredItems = items;
  
  if (showOnlyLocation) {
    filteredItems = filteredItems.filter(item => 
      showOnlyLocation === 'Unassigned' 
        ? (!item.location || item.location === null)
        : item.location === showOnlyLocation
    );
  } else {
    filteredItems = filteredItems.filter(item => {
      const locationMatch = filterLocation === 'all' || 
      (filterLocation === 'Unassigned' && (item.location === undefined || item.location === null))
      || item.location === filterLocation;
      const categoryMatch = filterCategory === 'all' || item.category === filterCategory;
      return locationMatch && categoryMatch;
    });
  }
  
  if (maxItemsToShow) {
    filteredItems = filteredItems.slice(0, maxItemsToShow);
  }

  // Group items by location
  const itemsByLocation = filteredItems.reduce((acc, item) => {
    const location = item.location || 'Unassigned';
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !onAddItem || !onUpdateItem) return;

    const finalLocation = showCustomLocation ? customLocation.trim() : formData.location;
    
    const itemData = {
      ...formData,
      name: formData.name.trim(),
      location: finalLocation || undefined,
      tags: formData.tags.filter(tag => tag.trim()),
    };

    if (editingId) {
      onUpdateItem(editingId, itemData);
      setEditingId(null);
    } else {
      onAddItem(itemData);
    }

    resetItemForm();
  };

  const resetItemForm = () => {
    setFormData(initialFormData);
    setShowItemForm(false);
    setEditingId(null);
    setTagInput('');
    setCustomLocation('');
    setShowCustomLocation(false);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      resetItemForm();
    }
  };

  const handleEditItem = (item: InventoryItem) => {
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
    
    // Check if location is custom (not in any existing locations)
    if (item.location && !allLocations.includes(item.location)) {
      setCustomLocation(item.location);
      setShowCustomLocation(true);
    }
    
    setEditingId(item.id);
    setShowItemForm(true);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const getTotalWeight = (items: InventoryItem[]) => {
    return items.reduce((total, item) => {
      return total + (item.weight ? item.weight * item.quantity : 0);
    }, 0);
  };

  const getTotalValue = (items: InventoryItem[]) => {
    return items.reduce((total, item) => {
      return total + (item.value ? item.value * item.quantity : 0);
    }, 0);
  };

  // Custom reorder handler for items within the same location
  const handleReorderItemsInLocation = (location: string) => (sourceIndex: number, destinationIndex: number) => {
    if (!onReorderItems) return;
    
    const itemsInLocation = itemsByLocation[location];
    const sourceItemId = itemsInLocation[sourceIndex].id;
    const destinationItemId = itemsInLocation[destinationIndex].id;
    
    // Find the indices in the main inventory array
    const sourceGlobalIndex = items.findIndex(item => item.id === sourceItemId);
    const destinationGlobalIndex = items.findIndex(item => item.id === destinationItemId);
    
    if (sourceGlobalIndex !== -1 && destinationGlobalIndex !== -1) {
      onReorderItems(sourceGlobalIndex, destinationGlobalIndex);
    }
  };

  const containerClasses = compact
    ? `bg-white rounded-lg shadow border border-purple-200 p-3 space-y-3 ${className}`
    : `bg-white rounded-lg shadow-lg border border-purple-200 p-6 space-y-6 ${className}`;

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between">
        <h2 className={`font-bold text-purple-800 flex items-center gap-2 ${compact ? 'text-base' : 'text-xl'}`}>
          <Package className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
          {compact ? 'Items' : 'Inventory'} ({filteredItems.length} items)
        </h2>
        {!readonly && !hideAddButton && onAddItem && (
          <button
            onClick={() => setShowItemForm(true)}
            className={`flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors ${compact ? 'text-sm' : ''}`}
          >
            <Plus size={16} />
            Add Item
          </button>
        )}
      </div>

      {/* Filters */}
      {!hideFilters && !showOnlyLocation && !compact && (
        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-800">Filters:</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-purple-700">Location:</label>
            <CustomDropdown
              options={locationOptions}
              value={filterLocation}
              onChange={setFilterLocation}
              className="min-w-44"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-purple-700">Category:</label>
            <CustomDropdown
              options={categoryOptions}
              value={filterCategory}
              onChange={setFilterCategory}
              className="min-w-44"
            />
          </div>

          {(filterLocation !== 'all' || filterCategory !== 'all') && (
            <button
              onClick={() => {
                setFilterLocation('all');
                setFilterCategory('all');
              }}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Items by Location */}
      {Object.keys(itemsByLocation).length > 0 ? (
        <div className={compact ? 'space-y-3' : 'space-y-6'}>
          {Object.entries(itemsByLocation).map(([location, locationItems]) => (
            <div key={location} className={`bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 ${compact ? 'p-3' : 'p-4'}`}>
              {!hideLocations && (
                <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
                  <h3 className={`font-semibold text-purple-800 flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
                    <MapPin size={compact ? 16 : 18} />
                    {location} ({locationItems.length} items)
                  </h3>
                  {!compact && (
                    <div className="text-sm text-purple-600">
                      <span className="mr-4">Weight: {getTotalWeight(locationItems).toFixed(1)} lbs</span>
                      <span>Value: {formatCurrencyFromCopper(getTotalValue(locationItems))}</span>
                    </div>
                  )}
                </div>
              )}
              {readonly || !onReorderItems ? (
                <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'}`}>
                  {locationItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onEdit={readonly ? undefined : handleEditItem}
                      onDelete={readonly || !onDeleteItem ? undefined : () => onDeleteItem(item.id)}
                      onQuantityChange={readonly || !onQuantityChange ? undefined : (quantity) => onQuantityChange(item.id, quantity)}
                      compact={compact}
                    />
                  ))}
                </div>
              ) : (
                <DragDropList
                  items={locationItems}
                  onReorder={handleReorderItemsInLocation(location)}
                  keyExtractor={(item) => item.id}
                  className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'}`}
                  showDragHandle={true}
                  dragHandlePosition="left"
                  renderItem={(item) => (
                    <ItemCard
                      item={item}
                      onEdit={readonly ? undefined : handleEditItem}
                      onDelete={readonly || !onDeleteItem ? undefined : () => onDeleteItem(item.id)}
                      onQuantityChange={readonly || !onQuantityChange ? undefined : (quantity) => onQuantityChange(item.id, quantity)}
                      compact={compact}
                    />
                  )}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <Package className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p className="font-medium">No items found</p>
          <p className="text-sm mt-1">
            {(filterLocation !== 'all' || filterCategory !== 'all') 
              ? 'Try adjusting your filters or add new items'
              : 'Add items to track your equipment and supplies'
            }
          </p>
        </div>
      )}

      {/* Item Form Modal */}
      {!readonly && showItemForm && onAddItem && onUpdateItem && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">
                  {editingId ? 'Edit Item' : 'Add Item'}
                </h3>
                <button
                  type="button"
                  onClick={resetItemForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleItemSubmit} className="space-y-6">
                <div>
                  <label className={labelStyles.base}>Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputStyles.purple}
                    placeholder="e.g., Rope (50 feet), Healing Potion"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyles.base}>Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className={selectStyles.purple}
                    >
                      {ITEM_CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelStyles.base}>Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      className={inputStyles.purple}
                      min="1"
                      required
                    />
                  </div>
                </div>

                {/* Rarity and Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyles.base}>Rarity</label>
                    <select
                      value={formData.rarity || ''}
                      onChange={(e) => setFormData({ ...formData, rarity: e.target.value as MagicItemRarity || undefined })}
                      className={selectStyles.purple}
                    >
                      <option value="">None/Standard</option>
                      {ITEM_RARITIES.map(rarity => (
                        <option key={rarity} value={rarity}>
                          {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={labelStyles.base}>Type</label>
                    <select
                      value={formData.type || ''}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as MagicItemCategory || undefined })}
                      className={selectStyles.purple}
                    >
                      <option value="">Standard Item</option>
                      {ITEM_TYPES.map(type => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Location Selection */}
                <div>
                  <label className={labelStyles.base}>Location</label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={showCustomLocation ? 'custom' : formData.location}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setShowCustomLocation(true);
                          } else {
                            setShowCustomLocation(false);
                            setFormData({ ...formData, location: e.target.value });
                          }
                        }}
                        className={selectStyles.purple.replace('w-full', 'flex-1')}
                      >
                        {allLocations.filter((location): location is string => Boolean(location)).map(location => (
                          <option key={location} value={location}>{location}</option>
                        ))}
                        <option value="custom">Custom Location...</option>
                      </select>
                    </div>
                    
                    {showCustomLocation && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={customLocation}
                          onChange={(e) => setCustomLocation(e.target.value)}
                          className={inputStyles.purple.replace('w-full', 'flex-1')}
                          placeholder="Enter custom location..."
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomLocation(false);
                            setCustomLocation('');
                          }}
                          className="px-3 py-3 text-gray-500 hover:text-gray-700 border-2 border-gray-300 rounded-lg hover:border-gray-400 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelStyles.base}>Weight (lbs)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.weight || ''}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className={inputStyles.purple}
                      placeholder="Per item"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className={labelStyles.base}>Value (cp)</label>
                    <input
                      type="number"
                      value={formData.value || ''}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value ? parseInt(e.target.value) : undefined })}
                      className={inputStyles.purple}
                      placeholder="Per item"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelStyles.base}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className={inputStyles.textarea.replace('focus:ring-blue-500 focus:border-blue-500', 'focus:ring-purple-500 focus:border-purple-500')}
                    rows={3}
                    placeholder="Item description, properties, or notes..."
                  />
                </div>

                <div>
                  <label className={labelStyles.base}>Tags</label>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      className={inputStyles.purple.replace('w-full', 'flex-1')}
                      placeholder="Add tag..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(index)}
                          className="text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={resetItemForm}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    {editingId ? 'Update' : 'Add'} Item
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ItemCardProps {
  item: InventoryItem;
  onEdit?: (item: InventoryItem) => void;
  onDelete?: () => void;
  onQuantityChange?: (quantity: number) => void;
  compact?: boolean;
}

function ItemCard({ item, onEdit, onDelete, onQuantityChange, compact = false }: ItemCardProps) {
  const totalWeight = item.weight ? item.weight * item.quantity : undefined;
  const totalValue = item.value ? item.value * item.quantity : undefined;

  return (
    <div className={`border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-all shadow-sm ${compact ? 'p-2' : 'p-3'}`}>
      <div className={`flex items-start justify-between ${compact ? 'mb-1' : 'mb-2'}`}>
        <h5 className={`font-semibold text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>{item.name}</h5>
        {(onEdit || onDelete) && (
          <div className="flex gap-1">
            {onEdit && (
              <button
                onClick={() => onEdit(item)}
                className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
                title="Edit item"
              >
                <Edit2 size={12} />
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="p-1 text-gray-600 hover:text-red-600 transition-colors"
                title="Delete item"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={`space-y-1 text-gray-600 ${compact ? 'text-xs' : 'text-xs'}`}>
        <div className="flex justify-between">
          <span>Category:</span>
          <span className="capitalize">{item.category}</span>
        </div>
        
        {/* Rarity and Type */}
        {(item.rarity || item.type) && !compact && (
          <div className="flex flex-wrap gap-1 mb-2">
            {item.rarity && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRarityColor(item.rarity)}`}>
                {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
              </span>
            )}
            {item.type && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span>Quantity:</span>
          {onQuantityChange ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onQuantityChange(Math.max(1, item.quantity - 1))}
                className="w-5 h-5 flex items-center justify-center bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
              >
                <Minus size={10} />
              </button>
              <span className="font-medium px-2">{item.quantity}</span>
              <button
                onClick={() => onQuantityChange(item.quantity + 1)}
                className="w-5 h-5 flex items-center justify-center bg-green-100 text-green-600 rounded hover:bg-green-200 transition-colors"
              >
                <Plus size={10} />
              </button>
            </div>
          ) : (
            <span className="font-medium">{item.quantity}</span>
          )}
        </div>

        {totalWeight !== undefined && !compact && (
          <div className="flex justify-between">
            <span>Weight:</span>
            <span>{totalWeight} lbs</span>
          </div>
        )}

        {totalValue !== undefined && !compact && (
          <div className="flex justify-between">
            <span>Value:</span>
            <span>{formatCurrencyFromCopper(totalValue)}</span>
          </div>
        )}

        {item.tags.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.tags.slice(0, 2).map((tag, index) => (
              <span
                key={index}
                className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
              >
                {tag}
              </span>
            ))}
            {item.tags.length > 2 && (
              <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                +{item.tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {item.description && !compact && (
        <p className="text-xs text-gray-700 mt-2 line-clamp-2">{item.description}</p>
      )}
    </div>
  );
}
