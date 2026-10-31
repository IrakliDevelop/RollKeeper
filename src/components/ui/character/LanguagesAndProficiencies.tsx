'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui/forms';
import { Section } from '@/components/ui/layout/section';
import { Language } from '@/types/character';

interface LanguagesProps {
  languages: Language[];
  onAddLanguage: (
    language: Omit<Language, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onDeleteLanguage: (id: string) => void;
  editing?: boolean;
}

export default function Languages({
  languages,
  onAddLanguage,
  onDeleteLanguage,
  editing = false,
}: LanguagesProps) {
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState('');

  const handleAddLanguage = () => {
    if (!newLanguageName.trim()) return;
    onAddLanguage({ name: newLanguageName.trim() });
    setNewLanguageName('');
    setIsAddingLanguage(false);
  };

  return (
    <Section
      heading="Languages"
      trailing={
        editing &&
        !isAddingLanguage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Add language"
            leftIcon={<Plus className="size-4" />}
            onClick={() => setIsAddingLanguage(true)}
          >
            Add
          </Button>
        )
      }
    >
      {editing && isAddingLanguage && (
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Input
            label="Language"
            value={newLanguageName}
            onChange={event => setNewLanguageName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') handleAddLanguage();
              if (event.key === 'Escape') {
                setIsAddingLanguage(false);
                setNewLanguageName('');
              }
            }}
            placeholder="Elvish"
            wrapperClassName="min-w-40 flex-1"
            autoFocus
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleAddLanguage}
          >
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsAddingLanguage(false);
              setNewLanguageName('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}
      {languages.length === 0 ? (
        <p className="text-muted text-sm">No languages added yet</p>
      ) : (
        <div className="divide-divider divide-y">
          {languages.map(language => (
            <div
              key={language.id}
              className="flex min-h-11 items-center justify-between gap-3 py-2"
            >
              <span className="text-body min-w-0 text-sm break-words">
                {language.name}
              </span>
              {editing && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  aria-label="Remove language"
                  onClick={() => onDeleteLanguage(language.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
