'use client';

import React, { useState } from 'react';
import { Plus, Edit3, Trash2, Save, X, BookOpen, PenTool } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import RichTextEditor from './RichTextEditor';
import NoteModal from './NoteModal';

interface NotesManagerProps {
  items: RichTextContent[];
  onAdd: (item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (id: string, updates: Partial<RichTextContent>) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export default function NotesManager({
  items,
  onAdd,
  onUpdate,
  onDelete,
  className = ''
}: NotesManagerProps) {
  // Safety guard to ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '' });
  const [viewMode, setViewMode] = useState<'read' | 'edit'>('read');
  const [selectedNote, setSelectedNote] = useState<RichTextContent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAdd = () => {
    if (newItem.title.trim()) {
      onAdd({
        title: newItem.title.trim(),
        content: newItem.content,
        category: 'note'
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

  const handleNoteClick = (note: RichTextContent) => {
    setSelectedNote(note);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNote(null);
  };

  const renderContent = (content: string) => {
    return (
      <div 
        className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
        style={{
          fontSize: '16px',
          lineHeight: '1.7',
          // Custom styling for better readability
          '--tw-prose-headings': '#1f2937',
          '--tw-prose-body': '#374151',
          '--tw-prose-bold': '#111827',
          '--tw-prose-links': '#2563eb',
          '--tw-prose-quotes': '#6b7280',
          '--tw-prose-quote-borders': '#d1d5db',
          '--tw-prose-captions': '#6b7280',
          '--tw-prose-code': '#111827',
          '--tw-prose-pre-code': '#e5e7eb',
          '--tw-prose-pre-bg': '#1f2937',
          '--tw-prose-th-borders': '#d1d5db',
          '--tw-prose-td-borders': '#e5e7eb',
        } as React.CSSProperties}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-blue-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-bold text-blue-800 border-b border-gray-200 pb-2">
            Session Notes
          </h2>
          <div className="flex items-center bg-blue-50 rounded-lg p-1 border border-blue-200">
            <button
              onClick={() => setViewMode('read')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
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
              className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition-all ${
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
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {/* Add New Note Form */}
      {isAdding && viewMode === 'edit' && (
        <div className="mb-6 p-6 border-2 bg-blue-50 border-blue-200 rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Note Title
              </label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                placeholder="Enter note title..."
                className="w-full px-4 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-800 mb-2">
                Note Content
              </label>
              <RichTextEditor
                content={newItem.content}
                onChange={(content) => setNewItem({ ...newItem, content })}
                placeholder="Write your note here..."
                className="min-h-40"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelAdd}
                className="flex items-center space-x-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <X size={16} />
                <span>Cancel</span>
              </button>
              <button
                onClick={handleAdd}
                disabled={!newItem.title.trim()}
                className="flex items-center space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        {safeItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">No notes yet</p>
            <p className="text-sm">
              {viewMode === 'edit' 
                ? "Click 'Add Note' to start taking notes about your adventures."
                : "Switch to Edit mode to start adding notes."
              }
            </p>
          </div>
        ) : (
          safeItems.map((item) => (
            <div key={item.id} className="border border-blue-100 rounded-lg p-6 bg-gradient-to-r from-blue-25 to-indigo-25 hover:shadow-md transition-all cursor-pointer hover:shadow-lg hover:border-blue-200">
              {editingId === item.id && viewMode === 'edit' ? (
                // Edit mode for individual note
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Note Title
                    </label>
                    <input
                      type="text"
                      defaultValue={item.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        // We'll save on blur or when save is clicked
                        e.target.setAttribute('data-title', newTitle);
                      }}
                      className="w-full px-4 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Note Content
                    </label>
                    <RichTextEditor
                      content={item.content}
                      onChange={(content) => {
                        // Store the content for saving later
                        document.querySelector(`[data-editing="${item.id}"]`)?.setAttribute('data-content', content);
                      }}
                      className="min-h-40"
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center space-x-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <X size={16} />
                      <span>Cancel</span>
                    </button>
                    <button
                      onClick={() => {
                        const container = document.querySelector(`[data-editing="${item.id}"]`);
                        const titleInput = container?.querySelector('input[data-title]') as HTMLInputElement;
                        const newTitle = titleInput?.getAttribute('data-title') || titleInput?.value || item.title;
                        const newContent = container?.getAttribute('data-content') || item.content;
                        
                        handleUpdate(item.id, {
                          title: newTitle,
                          content: newContent
                        });
                      }}
                      className="flex items-center space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    >
                      <Save size={16} />
                      <span>Save</span>
                    </button>
                  </div>
                </div>
              ) : (
                // Display mode
                <div data-editing={item.id} onClick={() => handleNoteClick(item)}>
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-semibold text-blue-900 flex-1">
                      {item.title}
                    </h3>
                    {viewMode === 'edit' && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(item.id);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                          title="Edit note"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors"
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
                          {renderContent(item.content)}
                        </div>
                        {item.content.length > 200 && (
                          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-blue-25 to-transparent"></div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No content yet...</p>
                    )}
                    
                    {viewMode === 'read' && (
                      <div className="mt-4 pt-3 border-t border-blue-100">
                        <p className="text-sm text-blue-600 font-medium">
                          {item.content && item.content.length > 200 ? 'Click to read full note →' : 'Click to view or edit in detail →'}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {item.updatedAt && (
                    <div className="mt-6 pt-4 border-t border-blue-200">
                      <p className="text-sm text-blue-600">
                        Last updated: {new Date(item.updatedAt).toLocaleDateString()} at {new Date(item.updatedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
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