'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '@/components/ui/forms';
import { Section } from '@/components/ui/layout/section';
import {
  ProficiencyDot,
  ProficiencyDotButton,
  skillDotLabel,
} from '@/components/ui/game/ProficiencyDot';
import { ToolProficiency, ToolProficiencyLevel } from '@/types/character';
import { useToolsData } from '@/hooks/useToolsData';

interface Props {
  toolProficiencies: ToolProficiency[];
  proficiencyBonus: number;
  onAddToolProficiency: (
    tool: Omit<ToolProficiency, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  onUpdateToolProficiency: (
    id: string,
    updates: Partial<ToolProficiency>
  ) => void;
  onDeleteToolProficiency: (id: string) => void;
  editing?: boolean;
}

const bonusFor = (level: ToolProficiencyLevel, bonus: number) =>
  level === 'expertise'
    ? `+${bonus * 2}`
    : level === 'proficient'
      ? `+${bonus}`
      : '';

export default function ToolProficienciesSection({
  toolProficiencies,
  proficiencyBonus,
  onAddToolProficiency,
  onUpdateToolProficiency,
  onDeleteToolProficiency,
  editing = false,
}: Props) {
  const { categories, loading } = useToolsData();
  const rowIdPrefix = useId();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pendingDeleteFocus = useRef(false);
  useEffect(() => {
    if (pendingDeleteFocus.current) {
      pendingDeleteFocus.current = false;
      addButtonRef.current?.focus();
    }
  }, [toolProficiencies]);
  const removeTool = (id: string) => {
    pendingDeleteFocus.current = true;
    onDeleteToolProficiency(id);
  };
  const byName = useMemo(
    () =>
      new Map(
        toolProficiencies.map(tool => [tool.name.trim().toLowerCase(), tool])
      ),
    [toolProficiencies]
  );
  const referenceNames = useMemo(
    () =>
      new Set(
        categories.flatMap(category =>
          category.items.map(name => name.toLowerCase())
        )
      ),
    [categories]
  );
  const customTools = toolProficiencies.filter(
    tool => !referenceNames.has(tool.name.trim().toLowerCase())
  );
  const activeTools = toolProficiencies.filter(
    tool => tool.proficiencyLevel !== 'none'
  );

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || byName.has(trimmed.toLowerCase())) return;
    onAddToolProficiency({ name: trimmed, proficiencyLevel: 'proficient' });
  };
  const saveCustom = () => {
    if (!customName.trim() || byName.has(customName.trim().toLowerCase()))
      return;
    add(customName);
    setCustomName('');
    setAddingCustom(false);
  };
  const toggleCategory = (id: string) => {
    setOpenCategories(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const editRow = (
    name: string,
    tool?: ToolProficiency,
    removeLabel?: string
  ) => {
    const level = tool?.proficiencyLevel ?? 'none';
    const nameId = `${rowIdPrefix}-${tool?.id ?? name}`;
    const nextLevel: ToolProficiencyLevel =
      level === 'none'
        ? 'proficient'
        : level === 'proficient'
          ? 'expertise'
          : 'none';
    return (
      <div
        key={tool?.id ?? name}
        className="border-divider flex min-h-11 flex-wrap items-center gap-3 border-b py-2 last:border-b-0"
      >
        <ProficiencyDotButton
          level={level}
          aria-label={skillDotLabel(name, level)}
          onClick={() => {
            if (!tool) add(name);
            else if (nextLevel === 'none') removeTool(tool.id);
            else
              onUpdateToolProficiency(tool.id, { proficiencyLevel: nextLevel });
          }}
        />
        <span
          id={nameId}
          className="text-body min-w-0 flex-1 text-sm break-words"
        >
          {name}
        </span>
        {tool && level !== 'none' && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              selected={Boolean(tool.isTemporary)}
              aria-pressed={Boolean(tool.isTemporary)}
              aria-describedby={nameId}
              onClick={() =>
                onUpdateToolProficiency(tool.id, {
                  isTemporary: !tool.isTemporary,
                })
              }
            >
              Temporary
            </Button>
            <span className="text-muted text-sm">
              {level === 'expertise' ? 'Expert' : 'Prof.'}{' '}
              {bonusFor(level, proficiencyBonus)}
            </span>
            {removeLabel && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                aria-label={removeLabel}
                aria-describedby={nameId}
                onClick={() => removeTool(tool.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Section
      heading="Tools"
      trailing={
        editing && (
          <Button
            ref={addButtonRef}
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="size-4" />}
            onClick={() => setAddingCustom(true)}
          >
            Custom
          </Button>
        )
      }
    >
      {!editing ? (
        <div className="divide-divider divide-y">
          {activeTools.length === 0 && (
            <p className="text-muted text-sm">No tool proficiencies.</p>
          )}
          {activeTools.map(tool => (
            <div
              key={tool.id}
              className="flex min-h-11 items-center gap-3 py-2"
            >
              <ProficiencyDot level={tool.proficiencyLevel} />
              <span className="text-body min-w-0 flex-1 text-sm break-words">
                {tool.name}
              </span>
              {tool.isTemporary && (
                <span className="text-muted text-sm">Temporary</span>
              )}
              <span className="text-muted text-sm">
                {bonusFor(tool.proficiencyLevel, proficiencyBonus)}
              </span>
            </div>
          ))}
          {activeTools.some(tool => tool.isTemporary) && (
            <p className="text-muted py-2 text-sm">Swap on a long rest</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-divider divide-y">
            {activeTools.map(tool =>
              editRow(tool.name, tool, 'Remove proficiency')
            )}
          </div>
          {activeTools.some(tool => tool.isTemporary) && (
            <p className="text-muted text-sm">Swap on a long rest</p>
          )}
          {addingCustom && (
            <div className="flex flex-wrap items-end gap-2">
              <Input
                label="Tool name"
                value={customName}
                onChange={event => setCustomName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') saveCustom();
                  if (event.key === 'Escape') {
                    setAddingCustom(false);
                    setCustomName('');
                  }
                }}
                placeholder="Kalimba"
                wrapperClassName="min-w-40 flex-1"
                autoFocus
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={saveCustom}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddingCustom(false);
                  setCustomName('');
                }}
              >
                Cancel
              </Button>
            </div>
          )}
          {!loading &&
            categories.map(category => {
              const open = openCategories.has(category.id);
              return (
                <div key={category.id} className="border-divider border-b pb-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between"
                    aria-expanded={open}
                    onClick={() => toggleCategory(category.id)}
                  >
                    <span>{category.label}</span>
                    {open ? (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                  {open && (
                    <div className="pl-3">
                      {category.items.map(name =>
                        editRow(name, byName.get(name.toLowerCase()))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          {customTools.length > 0 && (
            <div>
              <p className="text-heading font-medium">Custom</p>
              {customTools.map(tool =>
                editRow(tool.name, tool, 'Remove custom tool')
              )}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
