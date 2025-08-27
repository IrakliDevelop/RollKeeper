'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit3, Save, Eye, Trash2 } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import { ModalPortal } from '@/components/ui/feedback';
import { RichTextEditor } from '@/components/ui/forms';
import { RichTextRenderer } from '@/components/ui/utils';

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
  onDelete,
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
      content: editContent,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-blue-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex min-w-0 flex-1 items-center space-x-3">
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="min-w-0 flex-1 border-b-2 border-blue-300 bg-transparent text-xl font-semibold text-blue-900 focus:border-blue-600 focus:outline-none"
                  autoFocus
                />
              ) : (
                <h2 className="min-w-0 flex-1 truncate text-xl font-semibold text-blue-900">
                  {note.title}
                </h2>
              )}
            </div>

            <div className="ml-4 flex items-center space-x-2">
              {isEditing ? (
                <>
                  <button
                    onClick={handleCancel}
                    className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100"
                    title="Cancel editing"
                  >
                    <X size={20} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!editTitle.trim()}
                    className="flex items-center space-x-1 rounded-md bg-blue-600 px-3 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-md p-2 text-blue-600 transition-colors hover:bg-blue-100"
                    title="Edit note"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="rounded-md p-2 text-red-600 transition-colors hover:bg-red-100"
                    title="Delete note"
                  >
                    <Trash2 size={20} />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="rounded-md p-2 text-gray-600 transition-colors hover:bg-gray-100"
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
                  <label className="mb-2 block text-sm font-medium text-blue-800">
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
                  <div className="py-12 text-center text-gray-500">
                    <Eye className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                    <p className="mb-2 text-lg font-medium">No content yet</p>
                    <p className="text-sm">
                      Click Edit to add content to this note.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {note.updatedAt && !isEditing && (
            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <p className="text-sm text-gray-600">
                Last updated: {new Date(note.updatedAt).toLocaleDateString()} at{' '}
                {new Date(note.updatedAt).toLocaleTimeString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
}
