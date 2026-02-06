'use client';

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Save, X, BookOpen, PenTool } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import { RichTextEditor } from '@/components/ui/forms';
import { RichTextRenderer } from '@/components/ui/utils';
import { ToastData } from '@/components/ui/feedback/Toast';
import NoteModal from './NoteModal';
import DragDropList from '@/components/ui/layout/DragDropList';

interface NotesManagerProps {
  items: RichTextContent[];
  onAdd: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdate: (id: string, updates: Partial<RichTextContent>) => void;
  onDelete: (id: string) => void;
  onReorder?: (sourceIndex: number, destinationIndex: number) => void;
  onAddToast?: (toast: Omit<ToastData, 'id'>) => void;
  className?: string;
}

export default function NotesManager({
  items,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onAddToast,
  className = '',
}: NotesManagerProps) {
  // Safety guard to ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];

  // Sort items by order field if it exists, otherwise maintain current order
  const sortedItems = [...safeItems].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    return 0;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '' });
  const [editingItem, setEditingItem] = useState({ title: '', content: '' });
  const [viewMode, setViewMode] = useState<'read' | 'edit'>('read');
  const [selectedNote, setSelectedNote] = useState<RichTextContent | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleAdd = () => {
    if (newItem.title.trim()) {
      onAdd({
        title: newItem.title.trim(),
        content: newItem.content,
        category: 'note',
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
    setEditingItem({ title: '', content: '' });
  };

  const handleStartEdit = (item: RichTextContent) => {
    setEditingId(item.id);
    setEditingItem({ title: item.title, content: item.content });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingItem({ title: '', content: '' });
  };

  const handleSaveEdit = (id: string) => {
    handleUpdate(id, {
      title: editingItem.title,
      content: editingItem.content,
    });
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewItem({ title: '', content: '' });
  };

  const handleNoteClick = (note: RichTextContent) => {
    setSelectedNote(note);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNote(null);
  };

  const handleReorder = (sourceIndex: number, destinationIndex: number) => {
    if (onReorder) {
      onReorder(sourceIndex, destinationIndex);
    }
  };

  return (
    <div
      className={`border-accent-blue-border bg-surface-raised rounded-lg border p-6 shadow-lg ${className}`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="border-divider text-accent-blue-text border-b pb-2 text-xl font-bold">
            Session Notes
          </h2>
          <div className="border-accent-blue-border bg-accent-blue-bg flex items-center rounded-lg border p-1">
            <button
              onClick={() => setViewMode('read')}
              className={`flex items-center space-x-1 rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === 'read'
                  ? 'bg-accent-blue-bg-strong text-white shadow-sm'
                  : 'text-accent-blue-text-muted hover:bg-accent-blue-bg'
              }`}
            >
              <BookOpen size={14} />
              <span>Read</span>
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center space-x-1 rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === 'edit'
                  ? 'bg-accent-blue-bg-strong text-white shadow-sm'
                  : 'text-accent-blue-text-muted hover:bg-accent-blue-bg'
              }`}
            >
              <PenTool size={14} />
              <span>Edit</span>
            </button>
          </div>
        </div>

        {viewMode === 'edit' && (
          <button
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
            className="bg-accent-blue-bg-strong hover:bg-accent-blue-border-strong flex items-center space-x-2 rounded-md px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {/* Add New Note Form */}
      {isAdding && viewMode === 'edit' && (
        <div className="border-accent-blue-border bg-accent-blue-bg mb-6 rounded-lg border-2 p-6">
          <div className="space-y-4">
            <div>
              <label className="text-accent-blue-text mb-2 block text-sm font-medium">
                Note Title
              </label>
              <input
                type="text"
                value={newItem.title}
                onChange={e =>
                  setNewItem({ ...newItem, title: e.target.value })
                }
                placeholder="Enter note title..."
                className="border-accent-blue-border-strong text-heading focus:border-accent-blue-border-strong focus:ring-accent-blue-bg-strong w-full rounded-md border px-4 py-2 focus:ring-2 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="text-accent-blue-text mb-2 block text-sm font-medium">
                Note Content
              </label>
              <RichTextEditor
                content={newItem.content}
                onChange={content => setNewItem({ ...newItem, content })}
                placeholder="Write your note here..."
                className="min-h-40"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelAdd}
                className="border-divider-strong text-body hover:bg-surface-hover flex items-center space-x-1 rounded-md border px-4 py-2 transition-colors"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleAdd}
                disabled={!newItem.title.trim()}
                className="bg-accent-blue-bg-strong hover:bg-accent-blue-border-strong flex items-center space-x-1 rounded-md px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-6">
        {sortedItems.length === 0 ? (
          <div className="text-muted py-12 text-center">
            <BookOpen className="text-faint mx-auto mb-4 h-12 w-12" />
            <p className="mb-2 text-lg font-medium">No notes yet</p>
            <p className="text-sm">
              {viewMode === 'edit'
                ? "Click 'Add Note' to start taking notes about your adventures."
                : 'Switch to Edit mode to start adding notes.'}
            </p>
          </div>
        ) : (
          <DragDropList
            items={sortedItems}
            onReorder={handleReorder}
            keyExtractor={item => item.id}
            disabled={viewMode !== 'edit' || !onReorder}
            className="space-y-6"
            itemClassName="border border-accent-blue-border rounded-lg p-6 bg-gradient-to-r from-surface-raised to-surface-secondary hover:shadow-md transition-all cursor-pointer hover:shadow-lg hover:border-accent-blue-border"
            showDragHandle={viewMode === 'edit' && Boolean(onReorder)}
            dragHandlePosition="left"
            renderItem={item => (
              <>
                {editingId === item.id && viewMode === 'edit' ? (
                  // Edit mode for individual note
                  <div className="space-y-4">
                    <div>
                      <label className="text-accent-blue-text mb-2 block text-sm font-medium">
                        Note Title
                      </label>
                      <input
                        type="text"
                        value={editingItem.title}
                        onChange={e =>
                          setEditingItem({
                            ...editingItem,
                            title: e.target.value,
                          })
                        }
                        className="border-accent-blue-border-strong text-heading focus:border-accent-blue-border-strong focus:ring-accent-blue-bg-strong w-full rounded-md border px-4 py-2 focus:ring-2 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-accent-blue-text mb-2 block text-sm font-medium">
                        Note Content
                      </label>
                      <RichTextEditor
                        content={editingItem.content}
                        onChange={content =>
                          setEditingItem({ ...editingItem, content })
                        }
                        className="min-h-40"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={handleCancelEdit}
                        className="border-divider-strong text-body hover:bg-surface-hover flex items-center space-x-1 rounded-md border px-4 py-2 transition-colors"
                      >
                        <X size={16} />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={!editingItem.title.trim()}
                        className="bg-accent-blue-bg-strong hover:bg-accent-blue-border-strong flex items-center space-x-1 rounded-md px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save size={16} />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div onClick={() => handleNoteClick(item)}>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex flex-1 items-center gap-3">
                        <h3 className="text-accent-blue-text flex-1 text-xl font-semibold">
                          {item.title}
                        </h3>
                      </div>
                      {viewMode === 'edit' && (
                        <div className="ml-4 flex items-center space-x-2">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              handleStartEdit(item);
                            }}
                            className="text-accent-blue-text-muted hover:bg-accent-blue-bg rounded-md p-2 transition-colors"
                            title="Edit note"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onDelete(item.id);
                            }}
                            className="text-accent-red-text-muted hover:bg-accent-red-bg rounded-md p-2 transition-colors"
                            title="Delete note"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      {item.content ? (
                        <div className="relative">
                          <div className="max-h-32 overflow-hidden">
                            <RichTextRenderer content={item.content} />
                          </div>
                          {item.content.length > 200 && (
                            <div className="from-surface-raised absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t to-transparent"></div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted italic">No content yet...</p>
                      )}

                      {viewMode === 'read' && (
                        <div className="border-accent-blue-border mt-4 border-t pt-3">
                          <p className="text-accent-blue-text-muted text-sm font-medium">
                            {item.content && item.content.length > 200
                              ? 'Click to read full note →'
                              : 'Click to view or edit in detail →'}
                          </p>
                        </div>
                      )}
                    </div>

                    {item.updatedAt && (
                      <div className="border-accent-blue-border mt-6 border-t pt-4">
                        <p className="text-accent-blue-text-muted text-sm">
                          Last updated:{' '}
                          {new Date(item.updatedAt).toLocaleDateString()} at{' '}
                          {new Date(item.updatedAt).toLocaleTimeString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          />
        )}
      </div>

      {/* Note Modal */}
      <NoteModal
        note={selectedNote}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAddToast={onAddToast}
      />
    </div>
  );
}
