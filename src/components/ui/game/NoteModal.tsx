'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog-new';
import { Button, RichTextEditor } from '@/components/ui/forms';
import { ToastData } from '@/components/ui/feedback/Toast';

interface NoteModalProps {
  note: RichTextContent | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<RichTextContent>) => void;
  onDelete?: (id: string) => void;
  onAddToast?: (toast: Omit<ToastData, 'id'>) => void;
  /** Called instead of onUpdate when creating a new note */
  onCreate?: (title: string, content: string) => void;
}

export default function NoteModal({
  note,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onAddToast,
  onCreate,
}: NoteModalProps) {
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [initialNoteId, setInitialNoteId] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const isCreating = !note;

  useEffect(() => {
    if (isOpen) {
      if (note) {
        if (
          (!initialNoteId || initialNoteId !== note.id) &&
          !isSavingRef.current
        ) {
          setEditTitle(note.title);
          setEditContent(note.content);
          setInitialNoteId(note.id);
        }
        if (isSavingRef.current && initialNoteId === note.id) {
          isSavingRef.current = false;
        }
      } else {
        // Creating new note
        setEditTitle('');
        setEditContent('');
        setInitialNoteId(null);
      }
    } else {
      setInitialNoteId(null);
      isSavingRef.current = false;
    }
  }, [note, isOpen, initialNoteId]);

  const handleSave = () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) return;

    if (isCreating && onCreate) {
      onCreate(trimmedTitle, editContent);
    } else if (note && onUpdate) {
      isSavingRef.current = true;
      onUpdate(note.id, {
        title: trimmedTitle,
        content: editContent,
      });
    }

    if (onAddToast) {
      onAddToast({
        type: 'success',
        title: isCreating ? 'Note created' : 'Note saved',
        message: `"${trimmedTitle}" has been ${isCreating ? 'created' : 'saved'}`,
        duration: 3000,
      });
    }

    onClose();
  };

  const handleDelete = () => {
    if (!note || !onDelete) return;
    if (window.confirm('Are you sure you want to delete this note?')) {
      onDelete(note.id);
      onClose();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="sr-only">
          {isCreating ? 'New Note' : 'Edit Note'}
        </DialogTitle>
        <DialogBody className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-body text-sm font-medium">Title</label>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Note title..."
              autoFocus
              className="text-heading placeholder:text-faint border-divider focus:border-divider-strong w-full rounded-md border bg-transparent px-3 py-2 text-lg font-semibold transition-colors focus:outline-none"
            />
          </div>

          {/* Content */}
          <RichTextEditor
            content={editContent}
            onChange={setEditContent}
            placeholder="Write your note here..."
            minHeight="300px"
          />

          {/* Timestamp */}
          {note?.updatedAt && (
            <p className="text-faint text-xs">
              Last updated:{' '}
              {new Date(note.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}{' '}
              at{' '}
              {new Date(note.updatedAt).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </DialogBody>
        <DialogFooter className="flex items-center justify-between">
          {!isCreating && onDelete ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={handleDelete}
            >
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!editTitle.trim()}
            >
              {isCreating ? 'Create' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
