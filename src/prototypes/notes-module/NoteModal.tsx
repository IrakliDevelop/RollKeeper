'use client';

import React, { useState, useEffect } from 'react';
import { useProtoNotesStore, type ProtoNote } from './notesStore';
import FixedRichTextEditor from './FixedRichTextEditor';
import TagManager from './TagManager';
import { FancySelect } from '@/components/ui/FancySelect';
import { 
  X, 
  Save, 
  Pin, 
  PinOff,
  FileText,
  Users,
  Package,
  Map
} from 'lucide-react';

interface NoteModalProps {
  isOpen: boolean;
  noteId: string | null;
  onClose: () => void;
  isNewNote?: boolean;
}

export default function NoteModal({ isOpen, noteId, onClose, isNewNote = false }: NoteModalProps) {
  const { 
    notes, 
    updateNote, 
    deleteNote, 
    getPopularTags
  } = useProtoNotesStore();
  
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
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
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
      case 'session': return <FileText size={16} className="text-blue-600" />;
      case 'npc': return <Users size={16} className="text-green-600" />;
      case 'item': return <Package size={16} className="text-purple-600" />;
      case 'plot': return <Map size={16} className="text-orange-600" />;
      default: return <FileText size={16} className="text-gray-600" />;
    }
  };

  if (!isOpen || !editingNote) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-opacity-20 backdrop-blur-sm transition-all duration-200"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {getCategoryIcon(editingNote.category)}
            <input
              type="text"
              value={editingNote.title}
              onChange={(e) => updateEditingNote({ title: e.target.value })}
              className="text-xl font-bold bg-transparent border-none outline-none flex-1 min-w-0"
              placeholder="Note title..."
              autoFocus={isNewNote}
            />
            {hasChanges && (
              <span className="text-sm text-orange-600 font-medium">• Unsaved</span>
            )}
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <FancySelect
              value={editingNote.category}
              onChange={(value) => updateEditingNote({ category: value as string })}
              options={[
                { value: 'session', label: 'Session', description: 'Session notes and encounters' },
                { value: 'npc', label: 'NPC', description: 'Non-player characters' },
                { value: 'item', label: 'Item', description: 'Equipment and magic items' },
                { value: 'plot', label: 'Plot', description: 'Story and campaign notes' }
              ]}
              className="w-40"
              color="blue"
            />
            
            <button
              onClick={() => updateEditingNote({ isPinned: !editingNote.isPinned })}
              className={`p-2 rounded ${editingNote.isPinned ? 'text-yellow-600' : 'text-gray-400'}`}
              title={editingNote.isPinned ? 'Unpin note' : 'Pin note'}
            >
              {editingNote.isPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
            
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Save size={16} />
              Save
            </button>
            
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
          {/* Tags Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
            <TagManager
              tags={editingNote.tags}
              availableTags={getPopularTags()}
              onTagsChange={(tags) => updateEditingNote({ tags })}
            />
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0">
            <FixedRichTextEditor
              content={editingNote.content}
              onChange={(content) => updateEditingNote({ content })}
              placeholder="Write your note here..."
              className="h-full"
              minHeight="300px"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-500">
            {isNewNote ? 'New note' : `Last updated: ${new Date(editingNote.updatedAt).toLocaleString()}`}
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
