'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useProtoNotesStore, createSampleNotes, initializeSampleNotesIfEmpty, type ProtoNote } from './notesStore';
import FixedRichTextEditor from './FixedRichTextEditor';
import TagManager from './TagManager';
import FilterPanel, { type FilterOptions } from './FilterPanel';
import { FancySelect } from '@/components/ui/FancySelect';
import dynamic from 'next/dynamic';

// Dynamically import canvas with fallback
const NotesCanvas = dynamic(() => import('./NotesCanvas'), {
  loading: () => <div className="flex items-center justify-center h-full">Loading canvas...</div>,
  ssr: false,
});
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
  Map,
  Grid3X3,
  List,
  ArrowLeft,
  AlertTriangle,
  Group,
  Ungroup
} from 'lucide-react';
import Link from 'next/link';

type ViewMode = 'list' | 'editor' | 'canvas';

export default function NotesPrototype() {
  const {
    notes,
    hasInitialized,
    hasHydrated,
    createNote,
    updateNote,
    deleteNote,
    clearAllNotes,
    getPopularTags,
    initializeStore,
  } = useProtoNotesStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<ProtoNote | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    tags: [],
    pinned: null,
    sortBy: 'updated',
    sortOrder: 'desc'
  });
  const [isGrouped, setIsGrouped] = useState(false);

  // Initialize with sample data only on first visit
  useEffect(() => {
    // Wait for hydration to complete before initializing
    if (hasHydrated && !hasInitialized) {
      // Mark as initialized first
      initializeStore();
      
      // Only create sample notes if we have no notes at all
      if (notes.length === 0) {
        initializeSampleNotesIfEmpty();
      }
    }
  }, [hasHydrated, hasInitialized, notes.length, initializeStore]);

  // Close filter panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isFilterOpen && !(event.target as Element).closest('.filter-panel-container')) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  // Get available categories and tags for filtering
  const availableCategories = useMemo(() => 
    Array.from(new Set(notes.map(note => note.category))).sort()
  , [notes]);

  const availableTags = useMemo(() => 
    getPopularTags()
  , [getPopularTags]);

  // Apply comprehensive filtering and sorting
  const filteredAndSortedNotes = useMemo(() => {
    let filtered = notes;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(note => filters.categories.includes(note.category));
    }

    // Apply tag filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(note => 
        filters.tags.some(tag => note.tags.includes(tag))
      );
    }

    // Apply pinned filter
    if (filters.pinned !== null) {
      filtered = filtered.filter(note => note.isPinned === filters.pinned);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (filters.sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updated':
        default:
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }

      // Apply sort order
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    // Always show pinned notes first unless specifically filtering
    if (filters.pinned === null) {
      return sorted.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    }

    return sorted;
  }, [notes, searchQuery, filters]);

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
    const noteData = {
      title: '',
      content: '',
      category: 'session',
      tags: [],
      isPinned: false,
    };
    const id = createNote(noteData);
    
    // Create the editing note object immediately
    const newNote = {
      ...noteData,
      id,
      excerpt: 'Start writing your note here...',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setSelectedNoteId(id);
    setEditingNote(newNote);
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



  // Handle canvas mode
  if (viewMode === 'canvas') {
    return (
      <div className="h-screen flex flex-col">
        {/* Prototype Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">
                🧪 Test Prototype - This is an experimental notes feature in development
              </span>
            </div>
            <Link 
              href="/"
              className="flex items-center gap-2 px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Main
            </Link>
          </div>
        </div>
        
        {/* Canvas Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Notes Canvas</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded text-gray-600 hover:bg-gray-200"
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('canvas')}
                className="p-2 rounded text-gray-600 bg-white shadow"
                title="Canvas View"
              >
                <Grid3X3 size={16} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Canvas Content */}
        <div className="flex-1">
          <NotesCanvas />
        </div>
      </div>
    );
  }

  if (viewMode === 'editor' && editingNote) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Prototype Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">
                🧪 Test Prototype - This is an experimental notes feature in development
              </span>
            </div>
            <Link 
              href="/"
              className="flex items-center gap-2 px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Main
            </Link>
          </div>
        </div>
        
        {/* Editor Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={editingNote.title}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              className="text-xl font-bold bg-transparent border-none outline-none flex-1"
              style={{ color: '#1f2937' }}
              placeholder="Note title..."
            />
            <div className="flex items-center gap-2">
              <FancySelect
                value={editingNote.category}
                onChange={(value) => setEditingNote({ ...editingNote, category: value as string })}
                options={[
                  { value: 'session', label: 'Session', description: 'Session notes and encounters' },
                  { value: 'npc', label: 'NPC', description: 'Non-player characters' },
                  { value: 'item', label: 'Item', description: 'Equipment and magic items' },
                  { value: 'plot', label: 'Plot', description: 'Story and campaign notes' }
                ]}
                className="w-48"
                color="blue"
              />
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
                className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Tags Section */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
            <TagManager
              tags={editingNote.tags}
              availableTags={getPopularTags()}
              onTagsChange={(tags) => setEditingNote({ ...editingNote, tags })}
            />
          </div>

          {/* Editor */}
          <div className="flex-1">
            <FixedRichTextEditor
              content={editingNote.content}
              onChange={(content) => setEditingNote({ ...editingNote, content })}
              placeholder="Write your note here..."
              className="h-full"
              minHeight="calc(100vh - 400px)"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isGrouped ? 'min-h-screen' : 'h-screen'} flex flex-col bg-gray-50`}>
      {/* Prototype Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">
              🧪 Test Prototype - This is an experimental notes feature in development
            </span>
          </div>
          <Link 
            href="/"
            className="flex items-center gap-2 px-3 py-1 text-sm bg-amber-100 text-amber-800 rounded hover:bg-amber-200 transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Main
          </Link>
        </div>
      </div>
      
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Notes Prototype</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className="p-2 rounded text-gray-600 bg-white shadow"
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('canvas')}
                className="p-2 rounded text-gray-600 hover:bg-gray-200"
                title="Canvas View"
              >
                <Grid3X3 size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3">
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
              
              <div className="relative filter-panel-container">
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableCategories={availableCategories}
                  availableTags={availableTags}
                  isOpen={isFilterOpen}
                  onToggle={() => setIsFilterOpen(!isFilterOpen)}
                  className={isFilterOpen ? "absolute top-full right-0 mt-2 w-80 z-10" : ""}
                />
              </div>
            </div>
            
            <button
              onClick={() => setIsGrouped(!isGrouped)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isGrouped 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={isGrouped ? "Show all notes together" : "Group notes by category"}
            >
              {isGrouped ? <Ungroup size={16} /> : <Group size={16} />}
              {isGrouped ? 'Ungroup' : 'Group'}
            </button>
            
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
        {/* Results Summary */}
        {(searchQuery || filters.categories.length > 0 || filters.tags.length > 0 || filters.pinned !== null) && (
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredAndSortedNotes.length} of {notes.length} notes
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}

        {filteredAndSortedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <FileText size={48} className="mb-4" />
            <h3 className="text-lg font-medium mb-2">No notes found</h3>
            <p className="text-sm mb-4">
              {searchQuery || filters.categories.length > 0 || filters.tags.length > 0 || filters.pinned !== null
                ? 'Try adjusting your search or filters'
                : 'Create your first note to get started'
              }
            </p>
            {/* Show sample notes button if no notes and no filters active */}
            {notes.length === 0 && !searchQuery && filters.categories.length === 0 && filters.tags.length === 0 && filters.pinned === null && (
              <button
                onClick={createSampleNotes}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
              >
                Create Sample Notes
              </button>
            )}
          </div>
        ) : isGrouped ? (
          // Grouped view by category
          <div className="space-y-8">
            {['session', 'npc', 'item', 'plot'].map((category) => {
              const categoryNotes = filteredAndSortedNotes.filter(note => note.category === category);
              if (categoryNotes.length === 0) return null;

              return (
                <div key={category} className="bg-gray-50 rounded-lg p-6">
                  {/* Category Header */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                    {getCategoryIcon(category)}
                    <h2 className="text-lg font-bold text-gray-800 capitalize">
                      {category === 'npc' ? 'Characters' : category === 'session' ? 'Sessions' : category}
                    </h2>
                    <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-sm font-medium">
                      {categoryNotes.length}
                    </span>
                  </div>
                  
                  {/* Category Notes Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow ${
                          note.isPinned ? 'ring-2 ring-yellow-200' : ''
                        }`}
                      >
                        {/* Note Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1">
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
                </div>
              );
            })}
          </div>
        ) : (
          // Regular grid view
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedNotes.map((note) => (
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
