'use client';

import React, { useState } from 'react';
import { Plus, X, Languages as LanguagesIcon, Wrench } from 'lucide-react';
import { Button, Input } from '@/components/ui/forms';
import {
  Language,
  ToolProficiency,
  ToolProficiencyLevel,
} from '@/types/character';

interface LanguagesAndProficienciesProps {
  languages: Language[];
  toolProficiencies: ToolProficiency[];
  proficiencyBonus: number;
  onAddLanguage: (
    language: Omit<Language, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onDeleteLanguage: (id: string) => void;
  onAddToolProficiency: (
    tool: Omit<ToolProficiency, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateToolProficiency: (
    id: string,
    updates: Partial<ToolProficiency>
  ) => void;
  onDeleteToolProficiency: (id: string) => void;
}

export default function LanguagesAndProficiencies({
  languages,
  toolProficiencies,
  proficiencyBonus,
  onAddLanguage,
  onDeleteLanguage,
  onAddToolProficiency,
  onUpdateToolProficiency,
  onDeleteToolProficiency,
}: LanguagesAndProficienciesProps) {
  const [isAddingLanguage, setIsAddingLanguage] = useState(false);
  const [isAddingTool, setIsAddingTool] = useState(false);
  const [newLanguageName, setNewLanguageName] = useState('');
  const [newToolName, setNewToolName] = useState('');

  const handleAddLanguage = () => {
    if (newLanguageName.trim()) {
      onAddLanguage({ name: newLanguageName.trim() });
      setNewLanguageName('');
      setIsAddingLanguage(false);
    }
  };

  const handleAddTool = () => {
    if (newToolName.trim()) {
      onAddToolProficiency({
        name: newToolName.trim(),
        proficiencyLevel: 'proficient',
      });
      setNewToolName('');
      setIsAddingTool(false);
    }
  };

  const cycleProficiencyLevel = (tool: ToolProficiency) => {
    const levels: ToolProficiencyLevel[] = ['proficient', 'expertise', 'none'];
    const currentIndex = levels.indexOf(tool.proficiencyLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    onUpdateToolProficiency(tool.id, { proficiencyLevel: levels[nextIndex] });
  };

  const getProficiencyModifier = (level: ToolProficiencyLevel): string => {
    if (level === 'expertise') return `+${proficiencyBonus * 2}`;
    if (level === 'proficient') return `+${proficiencyBonus}`;
    return '+0';
  };

  const getProficiencyColor = (level: ToolProficiencyLevel): string => {
    if (level === 'expertise')
      return 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-purple-600 shadow-md dark:from-purple-600 dark:to-pink-600 dark:border-purple-500';
    if (level === 'proficient')
      return 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-600 shadow-md dark:from-blue-600 dark:to-indigo-600 dark:border-blue-500';
    return 'bg-bg-tertiary text-muted border-border-secondary';
  };

  return (
    <div className="border-accent-indigo-border from-accent-indigo-bg to-accent-purple-bg mt-4 space-y-4 rounded-lg border bg-gradient-to-br p-4 shadow-md">
      {/* Languages Section */}
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
                className="hover:bg-accent-red-bg h-5 w-5 rounded-full p-0.5 opacity-0 group-hover:opacity-100"
                title="Remove language"
              >
                <X size={14} className="text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Tool Proficiencies Section */}
      <div className="border-accent-indigo-border border-t-2 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-accent-indigo-text flex items-center gap-2 text-lg font-semibold">
            <Wrench size={18} className="text-accent-indigo-text-muted" />
            Tool Proficiencies
          </h3>
          {!isAddingTool && (
            <Button
              onClick={() => setIsAddingTool(true)}
              variant="primary"
              size="xs"
              leftIcon={<Plus size={16} />}
              className="bg-accent-indigo-text-muted hover:bg-accent-indigo-text"
              title="Add tool proficiency"
            />
          )}
        </div>

        {isAddingTool && (
          <div className="mb-3 flex items-center gap-2">
            <Input
              type="text"
              value={newToolName}
              onChange={e => setNewToolName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddTool();
                if (e.key === 'Escape') {
                  setIsAddingTool(false);
                  setNewToolName('');
                }
              }}
              placeholder="e.g., Thieves' Tools"
              className="flex-1"
              autoFocus
            />
            <Button
              onClick={handleAddTool}
              variant="primary"
              size="sm"
              className="bg-accent-indigo-text-muted hover:bg-accent-indigo-text"
            >
              Add
            </Button>
            <Button
              onClick={() => {
                setIsAddingTool(false);
                setNewToolName('');
              }}
              variant="ghost"
              size="sm"
              className="bg-bg-tertiary hover:bg-bg-tertiary/80 text-body"
            >
              Cancel
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {toolProficiencies.length === 0 && !isAddingTool && (
            <p className="text-accent-indigo-text-muted text-sm italic">
              No tool proficiencies added yet
            </p>
          )}
          {toolProficiencies.map(tool => (
            <div
              key={tool.id}
              className="group border-accent-indigo-border bg-surface-raised flex items-center justify-between rounded-lg border-2 p-3 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="text-heading text-sm font-semibold">
                  {tool.name}
                </span>
                <Button
                  onClick={() => cycleProficiencyLevel(tool)}
                  variant="ghost"
                  size="xs"
                  className={`cursor-pointer rounded-full border-2 px-3 py-1 text-xs font-bold transition-all hover:scale-105 hover:shadow-md ${getProficiencyColor(tool.proficiencyLevel)}`}
                  title="Click to cycle proficiency level"
                >
                  {tool.proficiencyLevel === 'expertise' && '⭐ Expert'}
                  {tool.proficiencyLevel === 'proficient' && '✓ Proficient'}
                  {tool.proficiencyLevel === 'none' && '○ None'}
                  {tool.proficiencyLevel !== 'none' && (
                    <span className="ml-1.5 font-mono">
                      {getProficiencyModifier(tool.proficiencyLevel)}
                    </span>
                  )}
                </Button>
              </div>
              <Button
                onClick={() => onDeleteToolProficiency(tool.id)}
                variant="ghost"
                size="xs"
                className="hover:bg-accent-red-bg rounded-full p-1.5 opacity-0 group-hover:opacity-100"
                title="Remove tool"
              >
                <X size={16} className="text-red-600" />
              </Button>
            </div>
          ))}
        </div>

        {toolProficiencies.length > 0 && (
          <div className="border-accent-indigo-border-strong bg-accent-indigo-bg-strong text-accent-indigo-text mt-3 rounded-lg border-2 p-3 text-xs shadow-sm">
            <p className="font-semibold">
              💡 Tip: Click on the proficiency badge to cycle levels
            </p>
            <p className="mt-1">
              ✓ Proficient → ⭐ Expert → ○ None → ✓ Proficient...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
