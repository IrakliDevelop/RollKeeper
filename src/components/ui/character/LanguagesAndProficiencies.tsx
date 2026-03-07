'use client';

import React, { useState } from 'react';
import { Plus, X, Languages as LanguagesIcon } from 'lucide-react';
import { Button, Input } from '@/components/ui/forms';
import { Language } from '@/types/character';

interface LanguagesProps {
  languages: Language[];
  onAddLanguage: (
    language: Omit<Language, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onDeleteLanguage: (id: string) => void;
}

export default function Languages({
  languages,
  onAddLanguage,
  onDeleteLanguage,
}: LanguagesProps) {
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState('');

  const handleAddLanguage = () => {
    if (newLanguageName.trim()) {
      onAddLanguage({ name: newLanguageName.trim() });
      setNewLanguageName('');
      setIsAddingLanguage(false);
    }
  };

  return (
    <div className="border-accent-indigo-border from-accent-indigo-bg to-accent-purple-bg mt-4 space-y-4 rounded-lg border bg-gradient-to-br p-4 shadow-md">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-accent-indigo-text flex items-center gap-2 text-lg font-semibold">
            <LanguagesIcon
              size={18}
              className="text-accent-indigo-text-muted"
            />
            Languages
          </h3>
          {!isAddingLanguage && (
            <Button
              onClick={() => setIsAddingLanguage(true)}
              variant="primary"
              size="xs"
              leftIcon={<Plus size={16} />}
              className="bg-accent-indigo-text-muted hover:bg-accent-indigo-text"
              title="Add language"
            />
          )}
        </div>

        {isAddingLanguage && (
          <div className="mb-3 flex items-center gap-2">
            <Input
              type="text"
              value={newLanguageName}
              onChange={e => setNewLanguageName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddLanguage();
                if (e.key === 'Escape') {
                  setIsAddingLanguage(false);
                  setNewLanguageName('');
                }
              }}
              placeholder="e.g., Elvish"
              className="flex-1"
              autoFocus
            />
            <Button
              onClick={handleAddLanguage}
              variant="primary"
              size="sm"
              className="bg-accent-indigo-text-muted hover:bg-accent-indigo-text"
            >
              Add
            </Button>
            <Button
              onClick={() => {
                setIsAddingLanguage(false);
                setNewLanguageName('');
              }}
              variant="ghost"
              size="sm"
              className="bg-bg-tertiary hover:bg-bg-tertiary/80 text-body"
            >
              Cancel
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {languages.length === 0 && !isAddingLanguage && (
            <p className="text-accent-indigo-text-muted text-sm italic">
              No languages added yet
            </p>
          )}
          {languages.map(lang => (
            <div
              key={lang.id}
              className="group border-accent-indigo-border-strong from-accent-indigo-bg-strong to-accent-purple-bg-strong text-accent-indigo-text flex items-center gap-2 rounded-full border-2 bg-gradient-to-r px-4 py-1.5 text-sm font-medium shadow-sm transition-all hover:shadow-md"
            >
              <span>{lang.name}</span>
              <Button
                onClick={() => onDeleteLanguage(lang.id)}
                variant="ghost"
                size="xs"
                className="hover:bg-accent-red-bg h-5 w-5 rounded-full p-0.5 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                title="Remove language"
              >
                <X size={14} className="text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
