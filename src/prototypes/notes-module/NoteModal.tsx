'use client';

import React, { useState, useEffect } from 'react';
import { useProtoNotesStore, type ProtoNote } from './notesStore';
import { RichTextEditor } from '@/components/ui/forms';
import TagManager from './TagManager';
import { FancySelect } from '@/components/ui/forms/FancySelect';
import {
  X,
  Save,
  Pin,
  PinOff,
  FileText,
  Users,
  Package,
  Map,
} from 'lucide-react';

interface NoteModalProps {
  isOpen: boolean;
  noteId: string | null;
  onClose: () => void;
  isNewNote?: boolean;
}

export default function NoteModal({
  isOpen,
  noteId,
  onClose,
  isNewNote = false,
}: NoteModalProps) {
  const { notes, updateNote, deleteNote, getPopularTags } =
    useProtoNotesStore();

  const [editingNote, setEditingNote] = useState<ProtoNote | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Find the note to edit
  useEffect(() => {
    if (noteId && isOpen) {
      const note = notes.find(n => n.id === noteId);
      if (note) {
        setEditingNote({ ...note });
        setHasChanges(false);
      } else if (isNewNote) {
        // For new notes, create a temporary editing object
        const tempNote: ProtoNote = {
          id: noteId,
          title: '',
          content: '',
          excerpt: '',
          category: 'session',
          tags: [],
          isPinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setEditingNote(tempNote);
        setHasChanges(false);
      }
    }
  }, [noteId, notes, isOpen, isNewNote]);

  // Handle closing modal
  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }

    // If it's a new note and we're canceling, delete it
    if (isNewNote && noteId && hasChanges) {
      deleteNote(noteId);
    }

    setEditingNote(null);
    setHasChanges(false);
    onClose();
  };

  // Handle saving
  const handleSave = () => {
    if (!editingNote) return;

    updateNote(editingNote.id, {
      title: editingNote.title,
      content: editingNote.content,
      category: editingNote.category,
      tags: editingNote.tags,
      isPinned: editingNote.isPinned,
    });

    setHasChanges(false);
    onClose();
  };

  // Handle note updates
  const updateEditingNote = (updates: Partial<ProtoNote>) => {
    if (!editingNote) return;
    setEditingNote({ ...editingNote, ...updates });
    setHasChanges(true);
  };

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

  if (!isOpen || !editingNote) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="bg-opacity-20 absolute inset-0 backdrop-blur-sm transition-all duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {getCategoryIcon(editingNote.category)}
            <input
              type="text"
              value={editingNote.title}
              onChange={e => updateEditingNote({ title: e.target.value })}
              className="min-w-0 flex-1 border-none bg-transparent text-xl font-bold outline-none"
              placeholder="Note title..."
              autoFocus={isNewNote}
            />
            {hasChanges && (
              <span className="text-sm font-medium text-orange-600">
                • Unsaved
              </span>
            )}
          </div>

          <div className="ml-4 flex items-center gap-2">
            <FancySelect
              value={editingNote.category}
              onChange={value =>
                updateEditingNote({ category: value as string })
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
              className="w-40"
              color="blue"
            />

            <button
              onClick={() =>
                updateEditingNote({ isPinned: !editingNote.isPinned })
              }
              className={`rounded p-2 ${editingNote.isPinned ? 'text-yellow-600' : 'text-gray-400'}`}
              title={editingNote.isPinned ? 'Unpin note' : 'Pin note'}
            >
              {editingNote.isPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Save size={16} />
              Save
            </button>

            <button
              onClick={handleClose}
              className="rounded p-2 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col space-y-4 overflow-hidden p-6">
          {/* Tags Section */}
          <div className="rounded-lg bg-gray-50 p-4">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Tags</h3>
            <TagManager
              tags={editingNote.tags}
              availableTags={getPopularTags()}
              onTagsChange={tags => updateEditingNote({ tags })}
            />
          </div>

          {/* Editor */}
          <div className="min-h-0 flex-1 bg-white">
            <RichTextEditor
              content={editingNote.content}
              onChange={content => updateEditingNote({ content })}
              placeholder="Write your note here..."
              className="h-full"
              minHeight="300px"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="text-sm text-gray-500">
            {isNewNote
              ? 'New note'
              : `Last updated: ${new Date(editingNote.updatedAt).toLocaleString()}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              disabled={!hasChanges}
            >
              {hasChanges ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
