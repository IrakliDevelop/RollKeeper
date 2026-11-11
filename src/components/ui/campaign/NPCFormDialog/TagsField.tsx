'use client';

import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Badge } from '@/components/ui/layout/badge';

interface TagsFieldProps {
  tags: string[];
  onAdd: (raw: string) => void;
  onRemove: (tag: string) => void;
  onRemoveLast: () => void;
}

export function TagsField({
  tags,
  onAdd,
  onRemove,
  onRemoveLast,
}: TagsFieldProps) {
  const [text, setText] = useState('');

  const commit = () => {
    onAdd(text);
    setText('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (
      event.key === 'Backspace' &&
      !event.repeat &&
      text === '' &&
      tags.length > 0
    ) {
      onRemoveLast();
    }
  };

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <li key={tag} className="flex items-center gap-0.5">
              <Badge variant="neutral" size="sm">
                {tag}
              </Badge>
              <Button
                variant="ghost"
                size="xs"
                aria-label={`Remove tag ${tag}`}
                onClick={() => onRemove(tag)}
              >
                <X size={14} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Input
        label="Tags"
        placeholder="merchant"
        helperText="Press Enter or a comma to add a tag."
        value={text}
        onChange={event => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (text.trim()) commit();
        }}
      />
    </div>
  );
}
