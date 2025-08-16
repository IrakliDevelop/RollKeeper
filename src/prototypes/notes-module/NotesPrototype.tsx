'use client';

import React, { useState, useEffect } from 'react';
import { useProtoNotesStore, createSampleNotes, type ProtoNote } from './notesStore';
import ImprovedRichTextEditor from './ImprovedRichTextEditor';
import { 
  Plus, 
  Search, 
  Pin, 
  PinOff, 
  Edit3, 
  Trash2, 
  Save, 
  X,
  FileText,
  Users,
  Package,
  Map
} from 'lucide-react';

type ViewMode = 'list' | 'editor';

export default function NotesPrototype() {
  const {
    notes,
    createNote,
    updateNote,
    deleteNote,
    clearAllNotes,
  } = useProtoNotesStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<ProtoNote | null>(null);

  // Initialize with sample data if no notes exist
  useEffect(() => {
    if (notes.length === 0) {
      createSampleNotes();
    }
  }, [notes.length]);

  // Filter notes based on search query
  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Category icons
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'session': return <FileText size={16} className="text-blue-600" />;
      case 'npc': return <Users size={16} className="text-green-600" />;
      case 'item': return <Package size={16} className="text-purple-600" />;
      case 'plot': return <Map size={16} className="text-orange-600" />;
      default: return <FileText size={16} className="text-gray-600" />;
    }
  };

  // Handle creating new note
  const handleCreateNote = () => {
    const id = createNote({
      title: 'New Note',
      content: '<p>Start writing your note here...</p>',
      category: 'session',
      tags: [],
      isPinned: false,
    });
    setSelectedNoteId(id);
    setViewMode('editor');
    setIsCreating(true);
  };

  // Handle editing existing note
  const handleEditNote = (note: ProtoNote) => {
    setSelectedNoteId(note.id);
    setEditingNote({ ...note });
    setViewMode('editor');
    setIsCreating(false);
  };

  // Handle saving note changes
  const handleSaveNote = () => {
    if (editingNote) {
      updateNote(editingNote.id, {
        title: editingNote.title,
        content: editingNote.content,
        category: editingNote.category,
        tags: editingNote.tags,
        isPinned: editingNote.isPinned,
      });
      setEditingNote(null);
      setViewMode('list');
    }
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    if (isCreating && selectedNoteId) {
      deleteNote(selectedNoteId);
    }
    setEditingNote(null);
    setSelectedNoteId(null);
    setViewMode('list');
    setIsCreating(false);
  };

  // Handle deleting note
  const handleDeleteNote = (id: string) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      deleteNote(id);
      if (selectedNoteId === id) {
        setViewMode('list');
        setSelectedNoteId(null);
        setEditingNote(null);
      }
    }
  };

  // Handle toggling pin
  const handleTogglePin = (note: ProtoNote) => {
    updateNote(note.id, { isPinned: !note.isPinned });
  };

  // Sort notes (pinned first, then by updated date)
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (viewMode === 'editor' && editingNote) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Editor Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={editingNote.title}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              className="text-xl font-bold bg-transparent border-none outline-none flex-1"
              placeholder="Note title..."
            />
            <div className="flex items-center gap-2">
              <select
                value={editingNote.category}
                onChange={(e) => setEditingNote({ ...editingNote, category: e.target.value })}
                className="px-3 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="session">Session</option>
                <option value="npc">NPC</option>
                <option value="item">Item</option>
                <option value="plot">Plot</option>
              </select>
              <button
                onClick={() => setEditingNote({ ...editingNote, isPinned: !editingNote.isPinned })}
                className={`p-2 rounded ${editingNote.isPinned ? 'text-yellow-600' : 'text-gray-400'}`}
                title={editingNote.isPinned ? 'Unpin note' : 'Pin note'}
              >
                {editingNote.isPinned ? <Pin size={16} /> : <PinOff size={16} />}
              </button>
              <button
                onClick={handleSaveNote}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 p-6">
          <ImprovedRichTextEditor
            content={editingNote.content}
            onChange={(content) => setEditingNote({ ...editingNote, content })}
            placeholder="Write your note here..."
            className="h-full"
            minHeight="calc(100vh - 200px)"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Notes Prototype</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} />
              New Note
            </button>
            <button
              onClick={clearAllNotes}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 p-6">
        {sortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText size={48} className="mb-4" />
            <h3 className="text-lg font-medium mb-2">No notes found</h3>
            <p className="text-sm">Create your first note or adjust your search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${
                  note.isPinned ? 'ring-2 ring-yellow-200' : ''
                }`}
              >
                {/* Note Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    {getCategoryIcon(note.category)}
                    <h3 className="font-semibold text-gray-900 truncate">{note.title}</h3>
                    {note.isPinned && (
                      <Pin size={14} className="text-yellow-600 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePin(note)}
                      className="p-1 text-gray-400 hover:text-yellow-600"
                      title={note.isPinned ? 'Unpin' : 'Pin'}
                    >
                      {note.isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                    </button>
                    <button
                      onClick={() => handleEditNote(note)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Note Content */}
                <div className="text-sm text-gray-600 mb-3 line-clamp-3">
                  {note.excerpt}
                </div>

                {/* Note Tags */}
                {note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Note Metadata */}
                <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
                  Updated {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
