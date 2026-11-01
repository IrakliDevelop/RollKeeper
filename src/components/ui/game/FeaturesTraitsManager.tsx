'use client';

import { useEffect, useRef, useState } from 'react';
import type { RichTextContent } from '@/types/character';
import { RichTextEditor } from '@/components/ui/forms';
import { Input } from '@/components/ui/forms/input';
import { Button } from '@/components/ui/forms/button';
import { Section } from '@/components/ui/layout/section';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog/confirmDialogStore';
import { RichTextRenderer } from '@/components/ui/utils';

type Category = 'feature' | 'trait';

interface FeaturesTraitsManagerProps {
  items: RichTextContent[];
  category: Category;
  onAdd: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdate: (id: string, updates: Partial<RichTextContent>) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export default function FeaturesTraitsManager({
  items,
  category,
  onAdd,
  onUpdate,
  onDelete,
  className,
}: FeaturesTraitsManagerProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Where focus returns once the inline form closes; the target only exists
  // (or is enabled) after the next render.
  const [returnFocusTo, setReturnFocusTo] = useState<string | null>(null);
  const title = category === 'feature' ? 'Features' : 'Traits';
  const addLabel = category === 'feature' ? 'Add feature' : 'Add trait';
  const deleteLabel =
    category === 'feature' ? 'Delete feature' : 'Delete trait';

  useEffect(() => {
    if (!returnFocusTo) return;
    const target =
      returnFocusTo === 'add'
        ? addButtonRef.current
        : listRef.current?.querySelector<HTMLButtonElement>(
            `[data-edit-id="${CSS.escape(returnFocusTo)}"]`
          );
    target?.focus();
    setReturnFocusTo(null);
  }, [returnFocusTo]);

  const closeAddForm = () => {
    setDraft({ title: '', content: '' });
    setIsAdding(false);
    setReturnFocusTo('add');
  };

  const closeEditForm = (id: string) => {
    setEditingId(null);
    setReturnFocusTo(id);
  };

  const handleSaveNew = () => {
    if (!draft.title.trim()) return;
    onAdd({ title: draft.title.trim(), content: draft.content, category });
    closeAddForm();
  };

  const handleDelete = (item: RichTextContent) => {
    void confirmDialog({
      title: `Delete ${item.title}?`,
      confirmLabel: deleteLabel,
      cancelLabel: 'Cancel',
      tone: 'danger',
    }).then(confirmed => {
      if (!confirmed) return;
      onDelete(item.id);
      setEditingId(null);
      setReturnFocusTo('add');
    });
  };

  return (
    <Section
      heading={title}
      level={3}
      className={className}
      trailing={
        <Button
          ref={addButtonRef}
          type="button"
          variant="secondary"
          size="sm"
          disabled={isAdding}
          onClick={() => setIsAdding(true)}
        >
          {addLabel}
        </Button>
      }
    >
      {isAdding && (
        <div className="border-divider space-y-3 border-b pb-4">
          <Input
            label="Name"
            value={draft.title}
            onChange={event =>
              setDraft(current => ({ ...current, title: event.target.value }))
            }
            placeholder={
              category === 'feature' ? 'Fighting Style' : 'Darkvision'
            }
            autoFocus
          />
          <div>
            <p className="type-ui text-body mb-2">Description</p>
            <RichTextEditor
              ariaLabel="Description"
              content={draft.content}
              onChange={content =>
                setDraft(current => ({ ...current, content }))
              }
              minHeight="100px"
              placeholder=""
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveNew}
              disabled={!draft.title.trim()}
            >
              Save
            </Button>
            <Button type="button" variant="ghost" onClick={closeAddForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {safeItems.length === 0 && !isAdding ? (
        <p className="type-body text-muted py-8 text-center">
          Add your first {category}.
        </p>
      ) : (
        <ul ref={listRef} className="divide-divider divide-y">
          {safeItems.map(item => (
            <li key={item.id} className="py-3 pointer-coarse:min-h-11">
              {editingId === item.id ? (
                <EditItemForm
                  item={item}
                  onSave={updates => {
                    onUpdate(item.id, updates);
                    closeEditForm(item.id);
                  }}
                  onCancel={() => closeEditForm(item.id)}
                />
              ) : (
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="type-ui text-heading font-semibold break-words">
                      {item.title}
                    </h4>
                    {item.content ? (
                      <RichTextRenderer
                        content={item.content}
                        className="type-body text-body mt-1 break-words"
                      />
                    ) : (
                      <p className="type-body text-muted mt-1">
                        No description.
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      data-edit-id={item.id}
                      onClick={() => setEditingId(item.id)}
                      aria-label={`Edit ${item.title}`}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(item)}
                      aria-label={`Delete ${item.title}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function EditItemForm({
  item,
  onSave,
  onCancel,
}: {
  item: RichTextContent;
  onSave: (updates: { title: string; content: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);

  return (
    <div className="space-y-3">
      <Input
        label="Name"
        value={title}
        onChange={event => setTitle(event.target.value)}
      />
      <div>
        <p className="type-ui text-body mb-2">Description</p>
        <RichTextEditor
          ariaLabel="Description"
          content={content}
          onChange={setContent}
          minHeight="100px"
          placeholder=""
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={!title.trim()}
          onClick={() => onSave({ title: title.trim(), content })}
        >
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
