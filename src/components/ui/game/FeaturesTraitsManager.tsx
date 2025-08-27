'use client';

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Save, X } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import { RichTextEditor } from '@/components/ui/forms';

interface FeaturesTraitsManagerProps {
  items: RichTextContent[];
  category: 'feature' | 'trait' | 'note';
  onAdd: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
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
  className = '',
}: FeaturesTraitsManagerProps) {
  // Safety guard to ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '' });

  const categoryName =
    category === 'feature'
      ? 'Features'
      : category === 'trait'
        ? 'Traits'
        : 'Notes';

  // Define concrete styles to avoid Tailwind CSS purging issues
  const styles =
    category === 'feature'
      ? {
          containerBorder: 'border-amber-200',
          headerText: 'text-amber-800',
          addButton: 'bg-amber-600 hover:bg-amber-700',
          formContainer: 'bg-amber-50 border-amber-200',
          saveButton: 'bg-amber-600 hover:bg-amber-700',
          itemBorder: 'border-amber-200',
          itemTitle: 'text-amber-900',
        }
      : category === 'trait'
        ? {
            containerBorder: 'border-emerald-200',
            headerText: 'text-emerald-800',
            addButton: 'bg-emerald-600 hover:bg-emerald-700',
            formContainer: 'bg-emerald-50 border-emerald-200',
            saveButton: 'bg-emerald-600 hover:bg-emerald-700',
            itemBorder: 'border-emerald-200',
            itemTitle: 'text-emerald-900',
          }
        : {
            containerBorder: 'border-blue-200',
            headerText: 'text-blue-800',
            addButton: 'bg-blue-600 hover:bg-blue-700',
            formContainer: 'bg-blue-50 border-blue-200',
            saveButton: 'bg-blue-600 hover:bg-blue-700',
            itemBorder: 'border-blue-200',
            itemTitle: 'text-blue-900',
          };

  const handleAdd = () => {
    if (newItem.title.trim()) {
      onAdd({
        title: newItem.title.trim(),
        content: newItem.content,
        category,
      });
      setNewItem({ title: '', content: '' });
      setIsAdding(false);
    }
  };

  const handleUpdate = (
    id: string,
    updates: { title?: string; content?: string }
  ) => {
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
    <div
      className={`rounded-lg border bg-white shadow-lg ${styles.containerBorder} p-6 ${className}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2
          className={`text-lg font-bold ${styles.headerText} border-b border-gray-200 pb-2`}
        >
          {categoryName}
        </h2>
        <button
          onClick={() => setIsAdding(true)}
          disabled={isAdding}
          className={`flex items-center space-x-1 px-3 py-1 ${styles.addButton} rounded-md text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Plus size={14} />
          <span>
            Add{' '}
            {category === 'feature'
              ? 'Feature'
              : category === 'trait'
                ? 'Trait'
                : 'Note'}
          </span>
        </button>
      </div>

      {/* Add New Item Form */}
      {isAdding && (
        <div className={`mb-4 border-2 p-4 ${styles.formContainer} rounded-lg`}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {category === 'feature'
                  ? 'Feature'
                  : category === 'trait'
                    ? 'Trait'
                    : 'Note'}{' '}
                Name
              </label>
              <input
                type="text"
                value={newItem.title}
                onChange={e =>
                  setNewItem({ ...newItem, title: e.target.value })
                }
                placeholder={`Enter ${category} name...`}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <RichTextEditor
                content={newItem.content}
                onChange={content => setNewItem({ ...newItem, content })}
                placeholder={`Describe this ${category}...`}
                minHeight="100px"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAdd}
                disabled={!newItem.title.trim()}
                className={`flex items-center space-x-1 px-3 py-2 ${styles.saveButton} rounded-md text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <Save size={14} />
                <span>Save</span>
              </button>
              <button
                onClick={handleCancelAdd}
                className="flex items-center space-x-1 rounded-md bg-gray-500 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-600"
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
          <div className="py-8 text-center text-gray-500">
            <p>
              No{' '}
              {category === 'feature'
                ? 'features'
                : category === 'trait'
                  ? 'traits'
                  : 'notes'}{' '}
              added yet.
            </p>
            <p className="mt-1 text-sm">
              Click &quot;Add{' '}
              {category === 'feature'
                ? 'Feature'
                : category === 'trait'
                  ? 'Trait'
                  : 'Note'}
              &quot; to get started.
            </p>
          </div>
        )}

        {safeItems.map(item => (
          <div
            key={item.id}
            className={`border ${styles.itemBorder} rounded-lg p-4 transition-shadow hover:shadow-sm`}
          >
            {editingId === item.id ? (
              <EditItemForm
                item={item}
                category={category}
                styles={styles}
                onSave={updates => handleUpdate(item.id, updates)}
                onCancel={handleCancelEdit}
              />
            ) : (
              <ViewItem
                item={item}
                styles={styles}
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

interface CategoryStyles {
  containerBorder: string;
  headerText: string;
  addButton: string;
  formContainer: string;
  saveButton: string;
  itemBorder: string;
  itemTitle: string;
}

interface EditItemFormProps {
  item: RichTextContent;
  category: 'feature' | 'trait' | 'note';
  styles: CategoryStyles;
  onSave: (updates: { title: string; content: string }) => void;
  onCancel: () => void;
}

function EditItemForm({
  item,
  category,
  styles,
  onSave,
  onCancel,
}: EditItemFormProps) {
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
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {category === 'feature'
            ? 'Feature'
            : category === 'trait'
              ? 'Trait'
              : 'Note'}{' '}
          Name
        </label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-800 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
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
          className={`flex items-center space-x-1 px-3 py-2 ${styles.saveButton} rounded-md text-sm text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
        >
          <Save size={14} />
          <span>Save</span>
        </button>
        <button
          onClick={onCancel}
          className="flex items-center space-x-1 rounded-md bg-gray-500 px-3 py-2 text-sm text-white transition-colors hover:bg-gray-600"
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
  styles: CategoryStyles;
  onEdit: () => void;
  onDelete: () => void;
}

function ViewItem({ item, styles, onEdit, onDelete }: ViewItemProps) {
  return (
    <>
      <div className="mb-2 flex items-start justify-between">
        <h3 className={`font-semibold ${styles.itemTitle}`}>{item.title}</h3>
        <div className="flex items-center space-x-1">
          <button
            onClick={onEdit}
            className="p-1 text-gray-500 transition-colors hover:text-blue-600"
            title="Edit"
          >
            <Edit3 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-500 transition-colors hover:text-red-600"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div
        className="rich-content text-sm text-gray-700"
        dangerouslySetInnerHTML={{
          __html:
            item.content ||
            '<p class="text-gray-500 italic">No description provided.</p>',
        }}
      />

      {/* Inline styles for proper rendering of rich content */}
      <style jsx>{`
        .rich-content :global(h1) {
          font-size: 1.125rem;
          font-weight: 700;
          line-height: 1.3;
          margin: 0.75rem 0 0.5rem 0;
          color: #1f2937;
        }
        .rich-content :global(h2) {
          font-size: 1rem;
          font-weight: 600;
          line-height: 1.4;
          margin: 0.5rem 0 0.25rem 0;
          color: #374151;
        }
        .rich-content :global(p) {
          margin: 0.25rem 0;
          line-height: 1.5;
        }
        .rich-content :global(ul) {
          margin: 0.25rem 0;
          padding-left: 1.25rem;
          list-style-type: disc;
        }
        .rich-content :global(ol) {
          margin: 0.25rem 0;
          padding-left: 1.25rem;
          list-style-type: decimal;
        }
        .rich-content :global(li) {
          margin: 0.125rem 0;
          line-height: 1.4;
        }
        .rich-content :global(strong) {
          font-weight: 600;
        }
        .rich-content :global(em) {
          font-style: italic;
        }
      `}</style>
    </>
  );
}
