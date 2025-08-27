'use client';

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Save, X, BookOpen, PenTool } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import { RichTextEditor } from '@/components/ui/forms';
import { RichTextRenderer } from '@/components/ui/utils';
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
  className?: string;
}

export default function NotesManager({
  items,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
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
  };

  const handleCancelEdit = () => {
    setEditingId(null);
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
      className={`rounded-lg border border-blue-200 bg-white p-6 shadow-lg ${className}`}
    >
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="border-b border-gray-200 pb-2 text-xl font-bold text-blue-800">
            Session Notes
          </h2>
          <div className="flex items-center rounded-lg border border-blue-200 bg-blue-50 p-1">
            <button
              onClick={() => setViewMode('read')}
              className={`flex items-center space-x-1 rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === 'read'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-600 hover:bg-blue-100'
              }`}
            >
              <BookOpen size={14} />
              <span>Read</span>
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center space-x-1 rounded-md px-3 py-1 text-sm font-medium transition-all ${
                viewMode === 'edit'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-blue-600 hover:bg-blue-100'
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
            className="flex items-center space-x-2 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {/* Add New Note Form */}
      {isAdding && viewMode === 'edit' && (
        <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-6">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-blue-800">
                Note Title
              </label>
              <input
                type="text"
                value={newItem.title}
                onChange={e =>
                  setNewItem({ ...newItem, title: e.target.value })
                }
                placeholder="Enter note title..."
                className="w-full rounded-md border border-blue-300 px-4 py-2 text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-blue-800">
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
                className="flex items-center space-x-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleAdd}
                disabled={!newItem.title.trim()}
                className="flex items-center space-x-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="py-12 text-center text-gray-500">
            <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-400" />
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
            itemClassName="border border-blue-100 rounded-lg p-6 bg-gradient-to-r from-blue-25 to-indigo-25 hover:shadow-md transition-all cursor-pointer hover:shadow-lg hover:border-blue-200"
            showDragHandle={viewMode === 'edit' && Boolean(onReorder)}
            dragHandlePosition="left"
            renderItem={item => (
              <>
                {editingId === item.id && viewMode === 'edit' ? (
                  // Edit mode for individual note
                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-blue-800">
                        Note Title
                      </label>
                      <input
                        type="text"
                        defaultValue={item.title}
                        onChange={e => {
                          const newTitle = e.target.value;
                          // We'll save on blur or when save is clicked
                          e.target.setAttribute('data-title', newTitle);
                        }}
                        className="w-full rounded-md border border-blue-300 px-4 py-2 text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-blue-800">
                        Note Content
                      </label>
                      <RichTextEditor
                        content={item.content}
                        onChange={content => {
                          // Store the content for saving later
                          document
                            .querySelector(`[data-editing="${item.id}"]`)
                            ?.setAttribute('data-content', content);
                        }}
                        className="min-h-40"
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center space-x-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <X size={16} />
                        <span>Cancel</span>
                      </button>
                      <button
                        onClick={() => {
                          const container = document.querySelector(
                            `[data-editing="${item.id}"]`
                          );
                          const titleInput = container?.querySelector(
                            'input[data-title]'
                          ) as HTMLInputElement;
                          const newTitle =
                            titleInput?.getAttribute('data-title') ||
                            titleInput?.value ||
                            item.title;
                          const newContent =
                            container?.getAttribute('data-content') ||
                            item.content;

                          handleUpdate(item.id, {
                            title: newTitle,
                            content: newContent,
                          });
                        }}
                        className="flex items-center space-x-1 rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                      >
                        <Save size={16} />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <div
                    data-editing={item.id}
                    onClick={() => handleNoteClick(item)}
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex flex-1 items-center gap-3">
                        <h3 className="flex-1 text-xl font-semibold text-blue-900">
                          {item.title}
                        </h3>
                      </div>
                      {viewMode === 'edit' && (
                        <div className="ml-4 flex items-center space-x-2">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingId(item.id);
                            }}
                            className="rounded-md p-2 text-blue-600 transition-colors hover:bg-blue-100"
                            title="Edit note"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onDelete(item.id);
                            }}
                            className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-100"
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
                            <div className="from-blue-25 absolute right-0 bottom-0 left-0 h-8 bg-gradient-to-t to-transparent"></div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">
                          No content yet...
                        </p>
                      )}

                      {viewMode === 'read' && (
                        <div className="mt-4 border-t border-blue-100 pt-3">
                          <p className="text-sm font-medium text-blue-600">
                            {item.content && item.content.length > 200
                              ? 'Click to read full note →'
                              : 'Click to view or edit in detail →'}
                          </p>
                        </div>
                      )}
                    </div>

                    {item.updatedAt && (
                      <div className="mt-6 border-t border-blue-200 pt-4">
                        <p className="text-sm text-blue-600">
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
      />
    </div>
  );
}
