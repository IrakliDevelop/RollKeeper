'use client';

import React, { useState } from 'react';
import { X, Plus, Tag } from 'lucide-react';

interface TagManagerProps {
  tags: string[];
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
}

export default function TagManager({
  tags,
  availableTags,
  onTagsChange,
  className = '',
}: TagManagerProps) {
  const [newTag, setNewTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter available tags that aren't already selected
  const filteredSuggestions = availableTags.filter(
    tag =>
      !tags.includes(tag) && tag.toLowerCase().includes(newTag.toLowerCase())
  );

  const addTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      onTagsChange([...tags, tag.trim()]);
      setNewTag('');
      setShowSuggestions(false);
    }
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(newTag);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setNewTag('');
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Current Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
            >
              <Tag size={12} />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 hover:text-blue-600"
                title="Remove tag"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Add New Tag */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newTag}
              onChange={e => {
                setNewTag(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onKeyDown={handleKeyPress}
              onFocus={() => setShowSuggestions(newTag.length > 0)}
              placeholder="Add tags..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />

            {/* Tag Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredSuggestions.slice(0, 8).map(suggestion => (
                  <button
                    key={suggestion}
                    onClick={() => addTag(suggestion)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <Tag size={12} className="text-gray-400" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => addTag(newTag)}
            disabled={!newTag.trim()}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Add tag"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Popular Tags */}
      {newTag === '' && availableTags.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Popular tags:</h4>
          <div className="flex flex-wrap gap-2">
            {availableTags
              .filter(tag => !tags.includes(tag))
              .slice(0, 8)
              .map(tag => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {tag}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
