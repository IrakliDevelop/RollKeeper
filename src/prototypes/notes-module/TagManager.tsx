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
  className = '' 
}: TagManagerProps) {
  const [newTag, setNewTag] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Filter available tags that aren't already selected
  const filteredSuggestions = availableTags.filter(tag => 
    !tags.includes(tag) && 
    tag.toLowerCase().includes(newTag.toLowerCase())
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
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
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
              onChange={(e) => {
                setNewTag(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onKeyDown={handleKeyPress}
              onFocus={() => setShowSuggestions(newTag.length > 0)}
              placeholder="Add tags..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            {/* Tag Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                {filteredSuggestions.slice(0, 8).map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => addTag(suggestion)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-600 text-sm flex items-center gap-2"
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
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
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
              .map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full hover:bg-gray-200 transition-colors"
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
