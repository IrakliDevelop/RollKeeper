'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  useProtoNotesStore,
  createSampleNotes,
  initializeSampleNotesIfEmpty,
  type ProtoNote,
} from './notesStore';
import { RichTextEditor } from '@/components/ui';
import TagManager from './TagManager';
import FilterPanel, { type FilterOptions } from './FilterPanel';
import { FancySelect } from '@/components/ui/forms/FancySelect';
import dynamic from 'next/dynamic';

// Dynamically import canvas with fallback
const NotesCanvas = dynamic(() => import('./NotesCanvas'), {
  loading: () => (
    <div className="flex h-full items-center justify-center">
      Loading canvas...
    </div>
  ),
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
  Ungroup,
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
    sortOrder: 'desc',
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
      if (
        isFilterOpen &&
        !(event.target as Element).closest('.filter-panel-container')
      ) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  // Get available categories and tags for filtering
  const availableCategories = useMemo(
    () => Array.from(new Set(notes.map(note => note.category))).sort(),
    [notes]
  );

  const availableTags = useMemo(() => getPopularTags(), [getPopularTags]);

  // Apply comprehensive filtering and sorting
  const filteredAndSortedNotes = useMemo(() => {
    let filtered = notes;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        note =>
          note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.tags.some(tag =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      );
    }

    // Apply category filter
    if (filters.categories.length > 0) {
      filtered = filtered.filter(note =>
        filters.categories.includes(note.category)
      );
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
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updated':
        default:
          comparison =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
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
      case 'session':
        return <FileText size={16} className="text-blue-600" />;
      case 'npc':
        return <Users size={16} className="text-green-600" />;
      case 'item':
        return <Package size={16} className="text-purple-600" />;
      case 'plot':
        return <Map size={16} className="text-orange-600" />;
      default:
        return <FileText size={16} className="text-gray-600" />;
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
      <div className="flex h-screen flex-col">
        {/* Prototype Banner */}
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">
                🧪 Test Prototype - This is an experimental notes feature in
                development
              </span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 rounded bg-amber-100 px-3 py-1 text-sm text-amber-800 transition-colors hover:bg-amber-200"
            >
              <ArrowLeft size={14} />
              Back to Main
            </Link>
          </div>
        </div>

        {/* Canvas Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Notes Canvas</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setViewMode('list')}
                className="rounded p-2 text-gray-600 hover:bg-gray-200"
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('canvas')}
                className="rounded bg-white p-2 text-gray-600 shadow"
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
      <div className="flex h-screen flex-col bg-gray-50">
        {/* Prototype Banner */}
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle size={16} />
              <span className="text-sm font-medium">
                🧪 Test Prototype - This is an experimental notes feature in
                development
              </span>
            </div>
            <Link
              href="/"
              className="flex items-center gap-2 rounded bg-amber-100 px-3 py-1 text-sm text-amber-800 transition-colors hover:bg-amber-200"
            >
              <ArrowLeft size={14} />
              Back to Main
            </Link>
          </div>
        </div>

        {/* Editor Header */}
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={editingNote.title}
              onChange={e =>
                setEditingNote({ ...editingNote, title: e.target.value })
              }
              className="flex-1 border-none bg-transparent text-xl font-bold outline-none"
              style={{ color: '#1f2937' }}
              placeholder="Note title..."
            />
            <div className="flex items-center gap-2">
              <FancySelect
                value={editingNote.category}
                onChange={value =>
                  setEditingNote({ ...editingNote, category: value as string })
                }
                options={[
                  {
                    value: 'session',
                    label: 'Session',
                    description: 'Session notes and encounters',
                  },
                  {
                    value: 'npc',
                    label: 'NPC',
                    description: 'Non-player characters',
                  },
                  {
                    value: 'item',
                    label: 'Item',
                    description: 'Equipment and magic items',
                  },
                  {
                    value: 'plot',
                    label: 'Plot',
                    description: 'Story and campaign notes',
                  },
                ]}
                className="w-48"
                color="blue"
              />
              <button
                onClick={() =>
                  setEditingNote({
                    ...editingNote,
                    isPinned: !editingNote.isPinned,
                  })
                }
                className={`rounded p-2 ${editingNote.isPinned ? 'text-yellow-600' : 'text-gray-400'}`}
                title={editingNote.isPinned ? 'Unpin note' : 'Pin note'}
              >
                {editingNote.isPinned ? (
                  <Pin size={16} />
                ) : (
                  <PinOff size={16} />
                )}
              </button>
              <button
                onClick={handleSaveNote}
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                <Save size={16} />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Editor Content */}
        <div className="flex-1 space-y-6 bg-white p-6">
          {/* Tags Section */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Tags</h3>
            <TagManager
              tags={editingNote.tags}
              availableTags={getPopularTags()}
              onTagsChange={tags => setEditingNote({ ...editingNote, tags })}
            />
          </div>

          {/* Editor */}
          <div className="flex-1 bg-white">
            <RichTextEditor
              content={editingNote.content}
              onChange={content => setEditingNote({ ...editingNote, content })}
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
    <div
      className={`${isGrouped ? 'min-h-screen' : 'h-screen'} flex flex-col bg-gray-50`}
    >
      {/* Prototype Banner */}
      <div className="border-b border-amber-200 bg-amber-50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">
              🧪 Test Prototype - This is an experimental notes feature in
              development
            </span>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded bg-amber-100 px-3 py-1 text-sm text-amber-800 transition-colors hover:bg-amber-200"
          >
            <ArrowLeft size={14} />
            Back to Main
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Notes Prototype</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setViewMode('list')}
                className="rounded bg-white p-2 text-gray-600 shadow"
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('canvas')}
                className="rounded p-2 text-gray-600 hover:bg-gray-200"
                title="Canvas View"
              >
                <Grid3X3 size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search
                  size={20}
                  className="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-gray-300 py-2 pr-4 pl-10 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="filter-panel-container relative">
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableCategories={availableCategories}
                  availableTags={availableTags}
                  isOpen={isFilterOpen}
                  onToggle={() => setIsFilterOpen(!isFilterOpen)}
                  className={
                    isFilterOpen
                      ? 'absolute top-full right-0 z-10 mt-2 w-80'
                      : ''
                  }
                />
              </div>
            </div>

            <button
              onClick={() => setIsGrouped(!isGrouped)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                isGrouped
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title={
                isGrouped
                  ? 'Show all notes together'
                  : 'Group notes by category'
              }
            >
              {isGrouped ? <Ungroup size={16} /> : <Group size={16} />}
              {isGrouped ? 'Ungroup' : 'Group'}
            </button>

            <button
              onClick={handleCreateNote}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Plus size={16} />
              New Note
            </button>
            <button
              onClick={clearAllNotes}
              className="rounded-lg border border-red-300 px-4 py-2 text-red-600 hover:bg-red-50"
            >
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="flex-1 p-6">
        {/* Results Summary */}
        {(searchQuery ||
          filters.categories.length > 0 ||
          filters.tags.length > 0 ||
          filters.pinned !== null) && (
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredAndSortedNotes.length} of {notes.length} notes
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}

        {filteredAndSortedNotes.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-gray-500">
            <FileText size={48} className="mb-4" />
            <h3 className="mb-2 text-lg font-medium">No notes found</h3>
            <p className="mb-4 text-sm">
              {searchQuery ||
              filters.categories.length > 0 ||
              filters.tags.length > 0 ||
              filters.pinned !== null
                ? 'Try adjusting your search or filters'
                : 'Create your first note to get started'}
            </p>
            {/* Show sample notes button if no notes and no filters active */}
            {notes.length === 0 &&
              !searchQuery &&
              filters.categories.length === 0 &&
              filters.tags.length === 0 &&
              filters.pinned === null && (
                <button
                  onClick={createSampleNotes}
                  className="rounded-lg bg-blue-100 px-4 py-2 text-sm text-blue-700 hover:bg-blue-200"
                >
                  Create Sample Notes
                </button>
              )}
          </div>
        ) : isGrouped ? (
          // Grouped view by category
          <div className="space-y-8">
            {['session', 'npc', 'item', 'plot'].map(category => {
              const categoryNotes = filteredAndSortedNotes.filter(
                note => note.category === category
              );
              if (categoryNotes.length === 0) return null;

              return (
                <div key={category} className="rounded-lg bg-gray-50 p-6">
                  {/* Category Header */}
                  <div className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-3">
                    {getCategoryIcon(category)}
                    <h2 className="text-lg font-bold text-gray-800 capitalize">
                      {category === 'npc'
                        ? 'Characters'
                        : category === 'session'
                          ? 'Sessions'
                          : category}
                    </h2>
                    <span className="rounded-full bg-gray-200 px-2 py-1 text-sm font-medium text-gray-700">
                      {categoryNotes.length}
                    </span>
                  </div>

                  {/* Category Notes Grid */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryNotes.map(note => (
                      <div
                        key={note.id}
                        className={`rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md ${
                          note.isPinned ? 'ring-2 ring-yellow-200' : ''
                        }`}
                      >
                        {/* Note Header */}
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex flex-1 items-center gap-2">
                            <h3 className="truncate font-semibold text-gray-900">
                              {note.title}
                            </h3>
                            {note.isPinned && (
                              <Pin
                                size={14}
                                className="flex-shrink-0 text-yellow-600"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTogglePin(note)}
                              className="p-1 text-gray-400 hover:text-yellow-600"
                              title={note.isPinned ? 'Unpin' : 'Pin'}
                            >
                              {note.isPinned ? (
                                <Pin size={14} />
                              ) : (
                                <PinOff size={14} />
                              )}
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
                        <div className="mb-3 line-clamp-3 text-sm text-gray-600">
                          {note.excerpt}
                        </div>

                        {/* Note Tags */}
                        {note.tags.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1">
                            {note.tags.map(tag => (
                              <span
                                key={tag}
                                className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Note Metadata */}
                        <div className="border-t border-gray-100 pt-2 text-xs text-gray-500">
                          Updated{' '}
                          {new Date(note.updatedAt).toLocaleDateString()}
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedNotes.map(note => (
              <div
                key={note.id}
                className={`rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md ${
                  note.isPinned ? 'ring-2 ring-yellow-200' : ''
                }`}
              >
                {/* Note Header */}
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    {getCategoryIcon(note.category)}
                    <h3 className="truncate font-semibold text-gray-900">
                      {note.title}
                    </h3>
                    {note.isPinned && (
                      <Pin
                        size={14}
                        className="flex-shrink-0 text-yellow-600"
                      />
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
                <div className="mb-3 line-clamp-3 text-sm text-gray-600">
                  {note.excerpt}
                </div>

                {/* Note Tags */}
                {note.tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {note.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Note Metadata */}
                <div className="border-t border-gray-100 pt-2 text-xs text-gray-500">
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
