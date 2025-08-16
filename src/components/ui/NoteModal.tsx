'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit3, Save, Eye, Trash2 } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import { ModalPortal } from './ModalPortal';
import RichTextEditor from './RichTextEditor';
import RichTextRenderer from './RichTextRenderer';

interface NoteModalProps {
  note: RichTextContent | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<RichTextContent>) => void;
  onDelete: (id: string) => void;
}

export default function NoteModal({
  note,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}: NoteModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Reset editing state when modal opens/closes or note changes
  useEffect(() => {
    if (note) {
      setEditTitle(note.title);
      setEditContent(note.content);
      setIsEditing(false);
    }
  }, [note, isOpen]);

  const handleSave = () => {
    if (!note) return;
    
    onUpdate(note.id, {
      title: editTitle.trim(),
      content: editContent
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (!note) return;
    
    setEditTitle(note.title);
    setEditContent(note.content);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!note) return;
    
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDelete(note.id);
      onClose();
    }
  };



  if (!note) return null;

  return (
    <ModalPortal isOpen={isOpen}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl border border-blue-200 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-semibold text-blue-900 bg-transparent border-b-2 border-blue-300 focus:border-blue-600 focus:outline-none flex-1 min-w-0"
                  autoFocus
                />
              ) : (
                <h2 className="text-xl font-semibold text-blue-900 truncate flex-1 min-w-0">
                  {note.title}
                </h2>
              )}
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                    title="Cancel editing"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!editTitle.trim()}
                    className="flex items-center space-x-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Save changes"
                  >
                    <Save size={16} />
                    <span>Save</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                    title="Edit note"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                    title="Delete note"
                  >
                    <Trash2 size={20} />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Close modal"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-blue-800 mb-2">
                    Note Content
                  </label>
                  <RichTextEditor
                    content={editContent}
                    onChange={setEditContent}
                    placeholder="Write your note here..."
                    className="min-h-96"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {note.content ? (
                  <RichTextRenderer content={note.content} />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Eye className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-lg font-medium mb-2">No content yet</p>
                    <p className="text-sm">Click Edit to add content to this note.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {note.updatedAt && !isEditing && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Last updated: {new Date(note.updatedAt).toLocaleDateString()} at {new Date(note.updatedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
} 