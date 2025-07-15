'use client';

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Save, X } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import RichTextEditor from './RichTextEditor';

interface FeaturesTraitsManagerProps {
  items: RichTextContent[];
  category: 'feature' | 'trait';
  onAdd: (item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<RichTextContent>) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export default function FeaturesTraitsManager({
  items,
  category,
  onAdd,
  onUpdate,
  onDelete,
  className = ''
}: FeaturesTraitsManagerProps) {
  // Safety guard to ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '' });

  const categoryName = category === 'feature' ? 'Features' : 'Traits';
  const categoryColor = category === 'feature' ? 'amber' : 'emerald';

  const handleAdd = () => {
    if (newItem.title.trim()) {
      onAdd({
        title: newItem.title.trim(),
        content: newItem.content,
        category
      });
      setNewItem({ title: '', content: '' });
      setIsAdding(false);
    }
  };

  const handleUpdate = (id: string, updates: { title?: string; content?: string }) => {
    onUpdate(id, updates);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewItem({ title: '', content: '' });
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-${categoryColor}-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg font-bold text-${categoryColor}-800 border-b border-gray-200 pb-2`}>
          {categoryName}
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className={`flex items-center space-x-1 px-3 py-1 bg-${categoryColor}-600 text-white rounded-md hover:bg-${categoryColor}-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm`}
        >
          <Plus size={14} />
          <span>Add {category === 'feature' ? 'Feature' : 'Trait'}</span>
        </button>
      </div>

      {/* Add New Item Form */}
      {isAdding && (
        <div className={`mb-4 p-4 border-2 border-${categoryColor}-200 rounded-lg bg-${categoryColor}-50`}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {category === 'feature' ? 'Feature' : 'Trait'} Name
              </label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder={`Enter ${category} name...`}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <RichTextEditor
                content={newItem.content}
                onChange={(content) => setNewItem({ ...newItem, content })}
                placeholder={`Describe this ${category}...`}
                minHeight="100px"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAdd}
                disabled={!newItem.title.trim()}
                className={`flex items-center space-x-1 px-3 py-2 bg-${categoryColor}-600 text-white rounded-md hover:bg-${categoryColor}-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm`}
              >
                <Save size={14} />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancelAdd}
                className="flex items-center space-x-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
              >
                <X size={14} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-3">
        {safeItems.length === 0 && !isAdding && (
          <div className="text-center py-8 text-gray-500">
            <p>No {category === 'feature' ? 'features' : 'traits'} added yet.</p>
            <p className="text-sm mt-1">Click &quot;Add {category === 'feature' ? 'Feature' : 'Trait'}&quot; to get started.</p>
          </div>
        )}

        {safeItems.map((item) => (
          <div key={item.id} className={`border border-${categoryColor}-200 rounded-lg p-4 hover:shadow-sm transition-shadow`}>
            {editingId === item.id ? (
              <EditItemForm
                item={item}
                category={category}
                categoryColor={categoryColor}
                onSave={(updates) => handleUpdate(item.id, updates)}
                onCancel={handleCancelEdit}
              />
            ) : (
              <ViewItem
                item={item}
                categoryColor={categoryColor}
                onEdit={() => setEditingId(item.id)}
                onDelete={() => onDelete(item.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface EditItemFormProps {
  item: RichTextContent;
  category: 'feature' | 'trait';
  categoryColor: string;
  onSave: (updates: { title: string; content: string }) => void;
  onCancel: () => void;
}

function EditItemForm({ item, category, categoryColor, onSave, onCancel }: EditItemFormProps) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);

  const handleSave = () => {
    if (title.trim()) {
      onSave({ title: title.trim(), content });
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {category === 'feature' ? 'Feature' : 'Trait'} Name
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <RichTextEditor
          content={content}
          onChange={setContent}
          minHeight="100px"
        />
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className={`flex items-center space-x-1 px-3 py-2 bg-${categoryColor}-600 text-white rounded-md hover:bg-${categoryColor}-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm`}
        >
          <Save size={14} />
          <span>Save</span>
        </button>
        <button
          onClick={onCancel}
          className="flex items-center space-x-1 px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
        >
          <X size={14} />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
}

interface ViewItemProps {
  item: RichTextContent;
  categoryColor: string;
  onEdit: () => void;
  onDelete: () => void;
}

function ViewItem({ item, categoryColor, onEdit, onDelete }: ViewItemProps) {
  return (
    <>
      <div className="flex items-start justify-between mb-2">
        <h3 className={`font-semibold text-${categoryColor}-900`}>{item.title}</h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={onEdit}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
            title="Edit"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-500 hover:text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div 
        className="text-sm text-gray-700 prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: item.content || '<p class="text-gray-500 italic">No description provided.</p>' }}
      />
    </>
  );
} 