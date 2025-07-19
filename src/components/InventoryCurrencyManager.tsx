'use client';

import React, { useState } from 'react';
import { InventoryItem, Currency } from '@/types/character';
import { useCharacterStore } from '@/store/characterStore';
import { Plus, Edit2, Trash2, Package, Coins, Minus } from 'lucide-react';

const ITEM_CATEGORIES = ['weapon', 'armor', 'tool', 'consumable', 'treasure', 'misc'];

const CURRENCY_TYPES: { [key in keyof Currency]: { name: string; abbr: string; color: string } } = {
  platinum: { name: 'Platinum', abbr: 'pp', color: 'text-slate-600' },
  gold: { name: 'Gold', abbr: 'gp', color: 'text-yellow-600' },
  electrum: { name: 'Electrum', abbr: 'ep', color: 'text-green-600' },
  silver: { name: 'Silver', abbr: 'sp', color: 'text-gray-600' },
  copper: { name: 'Copper', abbr: 'cp', color: 'text-orange-600' },
};

// Currency conversion rates (all relative to copper)
const CURRENCY_VALUES = {
  platinum: 1000,
  gold: 100,
  electrum: 50,
  silver: 10,
  copper: 1,
};

interface InventoryFormData {
  name: string;
  category: string;
  quantity: number;
  weight?: number;
  value?: number;
  description: string;
  tags: string[];
}

const initialFormData: InventoryFormData = {
  name: '',
  category: 'misc',
  quantity: 1,
  weight: undefined,
  value: undefined,
  description: '',
  tags: [],
};

export default function InventoryCurrencyManager() {
  const { 
    character, 
    addInventoryItem, 
    updateInventoryItem, 
    deleteInventoryItem, 
    updateItemQuantity,
    updateCurrency,
    addCurrency,
    subtractCurrency
  } = useCharacterStore();
  
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InventoryFormData>(initialFormData);
  const [tagInput, setTagInput] = useState('');
  const [currencyAmounts, setCurrencyAmounts] = useState<Currency>({
    copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0
  });

  // Calculate total wealth in copper pieces
  const totalWealthInCopper = Object.entries(character.currency).reduce((total, [type, amount]) => {
    return total + (amount * CURRENCY_VALUES[type as keyof Currency]);
  }, 0);

  // Convert total wealth to the most appropriate denominations
  const getWealthBreakdown = (totalCopper: number) => {
    if (totalCopper === 0) return 'No wealth';
    
    const breakdown = [];
    let remaining = totalCopper;
    
    // Convert to highest denominations first
    if (remaining >= CURRENCY_VALUES.platinum) {
      const pp = Math.floor(remaining / CURRENCY_VALUES.platinum);
      breakdown.push(`${pp} pp`);
      remaining %= CURRENCY_VALUES.platinum;
    }
    
    if (remaining >= CURRENCY_VALUES.gold) {
      const gp = Math.floor(remaining / CURRENCY_VALUES.gold);
      breakdown.push(`${gp} gp`);
      remaining %= CURRENCY_VALUES.gold;
    }
    
    if (remaining >= CURRENCY_VALUES.electrum) {
      const ep = Math.floor(remaining / CURRENCY_VALUES.electrum);
      breakdown.push(`${ep} ep`);
      remaining %= CURRENCY_VALUES.electrum;
    }
    
    if (remaining >= CURRENCY_VALUES.silver) {
      const sp = Math.floor(remaining / CURRENCY_VALUES.silver);
      breakdown.push(`${sp} sp`);
      remaining %= CURRENCY_VALUES.silver;
    }
    
    if (remaining > 0) {
      breakdown.push(`${remaining} cp`);
    }
    
    // Show up to 3 most significant denominations
    return breakdown.slice(0, 3).join(', ');
  };

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    const itemData = {
      ...formData,
      name: formData.name.trim(),
      tags: formData.tags.filter(tag => tag.trim()),
    };

    if (editingId) {
      updateInventoryItem(editingId, itemData);
      setEditingId(null);
    } else {
      addInventoryItem(itemData);
    }

    resetItemForm();
  };

  const resetItemForm = () => {
    setFormData(initialFormData);
    setShowItemForm(false);
    setEditingId(null);
    setTagInput('');
  };

  const handleEditItem = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      weight: item.weight,
      value: item.value,
      description: item.description || '',
      tags: item.tags,
    });
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

  const handleCurrencyChange = (type: keyof Currency, value: string) => {
    const amount = parseInt(value) || 0;
    setCurrencyAmounts(prev => ({ ...prev, [type]: amount }));
  };

  const addCurrencyAmount = (type: keyof Currency) => {
    const amount = currencyAmounts[type];
    if (amount > 0) {
      addCurrency(type, amount);
      setCurrencyAmounts(prev => ({ ...prev, [type]: 0 }));
    }
  };

  const subtractCurrencyAmount = (type: keyof Currency) => {
    const amount = currencyAmounts[type];
    if (amount > 0) {
      subtractCurrency(type, amount);
      setCurrencyAmounts(prev => ({ ...prev, [type]: 0 }));
    }
  };

  // Group items by category
  const itemsByCategory = character.inventoryItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <div className="space-y-6">
      {/* Currency Management */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-xl p-6">
        <h3 className="text-lg font-bold text-amber-800 mb-4 flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Currency & Wealth
        </h3>
        
        {/* Current Currency Display */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
            <div key={type} className="text-center">
              <div className="bg-white rounded-lg p-3 border border-yellow-300 shadow-sm">
                <div className={`text-2xl font-bold ${config.color}`}>
                  {character.currency[type as keyof Currency] || 0}
                </div>
                <div className="text-sm text-gray-600">{config.abbr}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Total Wealth */}
        <div className="text-center mb-6 p-3 bg-yellow-100 rounded-lg border border-yellow-300">
          <div className="text-lg font-semibold text-amber-800">
            Total Wealth: {getWealthBreakdown(totalWealthInCopper)}
          </div>
        </div>

        {/* Add/Subtract Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {Object.entries(CURRENCY_TYPES).map(([type, config]) => (
            <div key={type} className="space-y-2">
              <label className="block text-xs font-medium text-gray-700">
                {config.name}
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currencyAmounts[type as keyof Currency] || ''}
                  onChange={(e) => handleCurrencyChange(type as keyof Currency, e.target.value)}
                  className="w-full text-sm p-2 border border-gray-300 rounded focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => addCurrencyAmount(type as keyof Currency)}
                  className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  title="Add"
                >
                  +
                </button>
                <button
                  onClick={() => subtractCurrencyAmount(type as keyof Currency)}
                  className="flex-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  title="Subtract"
                >
                  -
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Inventory Management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory ({character.inventoryItems.length} items)
          </h3>
          <button
            onClick={() => setShowItemForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        {/* Items by Category */}
        {Object.keys(itemsByCategory).length > 0 ? (
          <div className="space-y-4">
            {Object.entries(itemsByCategory).map(([category, items]) => (
              <div key={category} className="bg-white rounded-lg border border-purple-200 p-4">
                <h4 className="font-semibold text-purple-800 mb-3 capitalize">
                  {category} ({items.length})
                </h4>
                <div className="space-y-3">
                  {items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onEdit={handleEditItem}
                      onDelete={() => deleteInventoryItem(item.id)}
                      onQuantityChange={(quantity) => updateItemQuantity(item.id, quantity)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="mx-auto h-12 w-12 text-gray-300 mb-2" />
            <p className="font-medium">No items in inventory</p>
            <p className="text-sm mt-1">Add items to track your equipment and supplies</p>
          </div>
        )}
      </div>

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                {editingId ? 'Edit Item' : 'Add Item'}
              </h3>
              
              <form onSubmit={handleItemSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                    placeholder="e.g., Rope (50 feet), Healing Potion"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                    >
                      {ITEM_CATEGORIES.map(category => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.weight || ''}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      placeholder="Per item"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value (cp)</label>
                    <input
                      type="number"
                      value={formData.value || ''}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      placeholder="Per item"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                    rows={3}
                    placeholder="Item description, properties, or notes..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white"
                      placeholder="Add tag..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
  onEdit: (item: InventoryItem) => void;
  onDelete: () => void;
  onQuantityChange: (quantity: number) => void;
}

function ItemCard({ item, onEdit, onDelete, onQuantityChange }: ItemCardProps) {
  const totalWeight = item.weight ? item.weight * item.quantity : undefined;
  const totalValue = item.value ? item.value * item.quantity : undefined;

  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-white hover:border-gray-300 transition-all">
      <div className="flex items-start justify-between mb-2">
        <h5 className="font-semibold text-gray-800 text-sm">{item.name}</h5>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(item)}
            className="p-1 text-gray-600 hover:text-blue-600 transition-colors"
            title="Edit item"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-600 hover:text-red-600 transition-colors"
            title="Delete item"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>Quantity:</span>
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
        </div>

        {totalWeight !== undefined && (
          <div className="flex justify-between">
            <span>Weight:</span>
            <span>{totalWeight} lbs</span>
          </div>
        )}

        {totalValue !== undefined && (
          <div className="flex justify-between">
            <span>Value:</span>
            <span>{Math.floor(totalValue / 100)} gp, {totalValue % 100} cp</span>
          </div>
        )}

        {item.tags.length > 0 && (
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

      {item.description && (
        <p className="text-xs text-gray-700 mt-2 line-clamp-2">{item.description}</p>
      )}
    </div>
  );
} 