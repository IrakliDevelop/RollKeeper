'use client';

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Edit3,
  Trash2,
  BookOpen,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { RichTextContent } from '@/types/character';
import { RichTextRenderer } from '@/components/ui/utils';
import { ToastData } from '@/components/ui/feedback/Toast';
import { Button } from '@/components/ui/forms/button';
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

  const sortedItems = useMemo(() => {
    let filtered = safeItems;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
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

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-heading text-lg font-semibold">Session Notes</h2>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Note
        </Button>
      </div>

      {/* Search & Sort */}
      {safeItems.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="min-w-[180px] flex-1">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
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
              <SelectTrigger className="h-8 w-[140px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="alphabetical">A–Z</SelectItem>
                <SelectItem value="manual">Manual Order</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Notes List */}
      {sortedItems.length === 0 ? (
        <div className="text-muted py-12 text-center">
          <BookOpen className="text-faint mx-auto mb-4 h-12 w-12" />
          <p className="mb-2 text-lg font-medium">
            {searchQuery ? 'No matching notes' : 'No notes yet'}
          </p>
          <p className="text-sm">
            {searchQuery
              ? 'Try a different search term.'
              : "Click 'Add Note' to start taking notes about your adventures."}
          </p>
        </div>
      ) : (
        <DragDropList
          items={sortedItems}
          onReorder={handleReorder}
          keyExtractor={item => item.id}
          disabled={!onReorder || sortBy !== 'manual'}
          className="space-y-3"
          itemClassName="bg-surface-raised rounded-lg border-2 border-divider hover:border-divider-strong p-4 transition-all cursor-pointer hover:shadow-md"
          showDragHandle={Boolean(onReorder) && sortBy === 'manual'}
          dragHandlePosition="left"
          renderItem={item => (
            <div className="flex items-start justify-between gap-3">
              <div
                className="min-w-0 flex-1"
                onClick={() => handleNoteClick(item)}
              >
                <h3 className="text-heading truncate text-sm font-semibold">
                  {item.title}
                </h3>
                {item.content ? (
                  <div className="mt-1.5 line-clamp-2 text-xs">
                    <RichTextRenderer content={item.content} />
                  </div>
                ) : (
                  <p className="text-faint mt-1.5 text-xs italic">No content</p>
                )}
                {item.updatedAt && (
                  <p className="text-faint mt-2 text-[11px]">
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
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleNoteClick(item);
                  }}
                  className="text-muted hover:text-accent-blue-text hover:bg-surface-hover rounded-md p-1.5 transition-colors"
                  title="View / Edit"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="text-muted hover:text-accent-red-text hover:bg-accent-red-bg rounded-md p-1.5 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
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
    </div>
  );
}
