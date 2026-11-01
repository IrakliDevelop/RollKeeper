'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Edit3, Trash2, Search, ArrowUpDown } from 'lucide-react';
import { RichTextContent } from '@/types/character';
import { RichTextRenderer } from '@/components/ui/utils';
import { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import { Section } from '@/components/ui/layout/section';
import { Input } from '@/components/ui/forms/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/forms/select';
import NoteModal from './NoteModal';
import DragDropList from '@/components/ui/layout/DragDropList';

type SortOption = 'newest' | 'oldest' | 'alphabetical' | 'manual';

interface NotesManagerProps {
  items: RichTextContent[];
  onAdd: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdate: (id: string, updates: Partial<RichTextContent>) => void;
  onDelete: (id: string) => void;
  onReorder?: (sourceIndex: number, destinationIndex: number) => void;
  onAddToast?: (toast: Omit<ToastData, 'id'>) => void;
  className?: string;
}

export default function NotesManager({
  items,
  onAdd,
  onUpdate,
  onDelete,
  onReorder,
  onAddToast,
  className = '',
}: NotesManagerProps) {
  const safeItems = useMemo(() => (Array.isArray(items) ? items : []), [items]);

  const [selectedNote, setSelectedNote] = useState<RichTextContent | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pendingDeleteFocus = useRef(false);
  useEffect(() => {
    if (pendingDeleteFocus.current) {
      pendingDeleteFocus.current = false;
      addButtonRef.current?.focus();
    }
  }, [items]);

  const sortedItems = useMemo(() => {
    let filtered = safeItems;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        item =>
          item.title.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q)
      );
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'oldest':
        sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case 'alphabetical':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'manual':
        sorted.sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order;
          }
          return 0;
        });
        break;
    }
    return sorted;
  }, [safeItems, sortBy, searchQuery]);

  const handleCreate = (title: string, content: string) => {
    onAdd({ title, content, category: 'note' });
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

  const handleDelete = async (item: RichTextContent) => {
    if (
      await confirmDialog({
        title: `Delete ${item.title}?`,
        confirmLabel: 'Delete note',
        cancelLabel: 'Cancel',
        tone: 'danger',
      })
    ) {
      pendingDeleteFocus.current = true;
      onDelete(item.id);
    }
  };

  return (
    <Section
      heading="Session notes"
      className={className}
      trailing={
        <Button
          ref={addButtonRef}
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add note
        </Button>
      }
    >
      {/* Search & Sort */}
      {safeItems.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[180px] flex-1">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              size="sm"
              leftIcon={<Search size={14} />}
              clearable
              onClear={() => setSearchQuery('')}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown size={14} className="text-muted" />
            <Select
              value={sortBy}
              onValueChange={v => setSortBy(v as SortOption)}
            >
              <SelectTrigger
                aria-label="Sort notes"
                className="h-8 min-w-32 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="alphabetical">A–Z</SelectItem>
                <SelectItem value="manual">Manual order</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Notes List */}
      {sortedItems.length === 0 ? (
        <div className="text-muted py-12 text-center">
          <p className="mb-2 text-lg font-medium">
            {searchQuery
              ? `No notes match “${searchQuery.trim()}”.`
              : 'Write your first note'}
          </p>
        </div>
      ) : (
        <DragDropList
          items={sortedItems}
          onReorder={handleReorder}
          keyExtractor={item => item.id}
          disabled={!onReorder || sortBy !== 'manual'}
          className="divide-divider divide-y"
          itemClassName="py-3"
          showDragHandle={Boolean(onReorder) && sortBy === 'manual'}
          dragHandlePosition="left"
          renderItem={item => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-heading text-sm font-semibold break-words">
                  <button
                    type="button"
                    className="text-left pointer-coarse:min-h-11"
                    onClick={() => handleNoteClick(item)}
                  >
                    {item.title}
                  </button>
                </h3>
                {item.content ? (
                  <div className="mt-1.5 line-clamp-2 text-xs">
                    <RichTextRenderer content={item.content} />
                  </div>
                ) : (
                  <p className="text-muted mt-1.5 text-xs italic">No content</p>
                )}
                {item.updatedAt && (
                  <p className="text-muted mt-2 text-xs">
                    Updated{' '}
                    {new Date(item.updatedAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {new Date(item.updatedAt).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleNoteClick(item)}
                  aria-label={`Edit ${item.title}`}
                >
                  <Edit3 size={14} />
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => void handleDelete(item)}
                  aria-label={`Delete ${item.title}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* Edit Modal */}
      <NoteModal
        note={selectedNote}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onAddToast={onAddToast}
      />

      {/* Add Modal */}
      <NoteModal
        note={null}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreate={handleCreate}
        onAddToast={onAddToast}
      />
    </Section>
  );
}
