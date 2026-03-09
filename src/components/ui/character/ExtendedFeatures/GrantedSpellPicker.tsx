/**
 * GrantedSpellPicker Component
 * Shows spells granted by a feat and lets the user confirm adding them.
 * For "choose" entries, provides a filtered spell autocomplete.
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ProcessedSpell } from '@/types/spells';
import { Spell } from '@/types/character';
import { Modal } from '@/components/ui/feedback';
import { Button } from '@/components/ui/forms';
import { cn } from '@/utils/cn';
import {
  ParsedAdditionalSpells,
  ParsedChooseSpell,
  SpellListGroup,
  parseChooseFilter,
  grantTypeLabel,
} from '@/utils/additionalSpellsParser';
import {
  resolveGrantedSpells,
  resolveChosenSpell,
  filterSpellsByChooseFilter,
  ResolvedSpell,
} from '@/utils/additionalSpellsResolver';
import {
  Sparkles,
  Check,
  AlertTriangle,
  Plus,
  X,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';

interface GrantedSpellPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (spells: Spell[]) => void;
  featName: string;
  parsed: ParsedAdditionalSpells;
  allSpells: ProcessedSpell[];
  spellsLoading: boolean;
}

const SCHOOL_ICONS: Record<string, string> = {
  Abjuration: '🛡️',
  Conjuration: '🌀',
  Divination: '🔮',
  Enchantment: '💫',
  Evocation: '⚡',
  Illusion: '✨',
  Necromancy: '💀',
  Transmutation: '🔄',
};

interface ChooseSlot {
  choice: ParsedChooseSpell;
  index: number;
  selectedSpell: Spell | null;
  filterDescription: string;
}

export default function GrantedSpellPicker({
  isOpen,
  onClose,
  onConfirm,
  featName,
  parsed,
  allSpells,
  spellsLoading,
}: GrantedSpellPickerProps) {
  const hasGroups = parsed.groups && parsed.groups.length > 1;
  const [selectedGroup, setSelectedGroup] = useState<SpellListGroup | null>(
    null
  );

  // The active parsed data: either from a selected group or from flat parsed result
  const activeParsed: ParsedAdditionalSpells = useMemo(() => {
    if (hasGroups && selectedGroup) {
      return {
        ability: selectedGroup.ability,
        concrete: selectedGroup.concrete,
        choices: selectedGroup.choices,
      };
    }
    return parsed;
  }, [hasGroups, selectedGroup, parsed]);

  const showGroupPicker = hasGroups && !selectedGroup;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Feat Grants Spells"
      size="lg"
    >
      <div className="space-y-6">
        <div className="border-accent-purple-border bg-accent-purple-bg flex items-start gap-3 rounded-lg border p-4">
          <Sparkles className="text-accent-purple-text mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="text-heading text-sm font-medium">
              <strong>{featName}</strong> grants spells to your character.
            </p>
            <p className="text-muted mt-1 text-xs">
              {showGroupPicker
                ? 'First, choose which spell list you want to pick from.'
                : 'Review the spells below and confirm which to add to your spell list.'}
            </p>
          </div>
        </div>

        {showGroupPicker ? (
          <GroupPickerView
            groups={parsed.groups!}
            onSelect={setSelectedGroup}
          />
        ) : (
          <SpellSelectionView
            parsed={activeParsed}
            featName={featName}
            allSpells={allSpells}
            spellsLoading={spellsLoading}
            onConfirm={onConfirm}
            onClose={onClose}
            onBack={hasGroups ? () => setSelectedGroup(null) : undefined}
            selectedGroupName={selectedGroup?.name}
          />
        )}

        {showGroupPicker && (
          <div className="border-divider flex justify-end border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              Skip
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function GroupPickerView({
  groups,
  onSelect,
}: {
  groups: SpellListGroup[];
  onSelect: (group: SpellListGroup) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-heading text-sm font-semibold">
        Choose a Spell List
      </h4>
      <div className="space-y-1">
        {groups.map((group, idx) => {
          const spellCount =
            group.concrete.length +
            group.choices.reduce((sum, c) => sum + c.count, 0);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(group)}
              className="border-divider bg-surface-raised hover:border-accent-purple-border hover:bg-surface-hover flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-heading text-sm font-medium">{group.name}</p>
                <p className="text-muted text-xs">
                  {spellCount} {spellCount === 1 ? 'spell' : 'spells'} to choose
                </p>
              </div>
              <ChevronRight className="text-muted h-4 w-4 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SpellSelectionView({
  parsed,
  featName,
  allSpells,
  spellsLoading,
  onConfirm,
  onClose,
  onBack,
  selectedGroupName,
}: {
  parsed: ParsedAdditionalSpells;
  featName: string;
  allSpells: ProcessedSpell[];
  spellsLoading: boolean;
  onConfirm: (spells: Spell[]) => void;
  onClose: () => void;
  onBack?: () => void;
  selectedGroupName?: string;
}) {
  const { resolved, unresolved } = useMemo(
    () => resolveGrantedSpells(parsed, allSpells, featName),
    [parsed, allSpells, featName]
  );

  const [excludedSpells, setExcludedSpells] = useState<Set<number>>(new Set());

  const initialChooseSlots = useMemo((): ChooseSlot[] => {
    const slots: ChooseSlot[] = [];
    for (const choice of parsed.choices) {
      const filter = parseChooseFilter(choice.filter);
      const parts: string[] = [];
      if (filter.level !== undefined) {
        parts.push(filter.level === 0 ? 'Cantrip' : `Level ${filter.level}`);
      }
      if (filter.className) parts.push(`${filter.className} spell`);
      if (filter.schools?.length)
        parts.push(`School: ${filter.schools.join(', ')}`);
      if (filter.ritual) parts.push('Ritual');

      for (let i = 0; i < choice.count; i++) {
        slots.push({
          choice,
          index: i,
          selectedSpell: null,
          filterDescription: parts.join(' • ') || 'Any spell',
        });
      }
    }
    return slots;
  }, [parsed.choices]);

  const [chooseSlots, setChooseSlots] =
    useState<ChooseSlot[]>(initialChooseSlots);

  const handleChooseSelect = (slotIdx: number, spell: ProcessedSpell) => {
    const slot = chooseSlots[slotIdx];
    const charSpell = resolveChosenSpell(
      spell,
      slot.choice.grantType,
      slot.choice.freeCastMax,
      slot.choice.restType,
      slot.choice.isAlwaysPrepared,
      featName
    );
    setChooseSlots(prev =>
      prev.map((s, i) =>
        i === slotIdx ? { ...s, selectedSpell: charSpell } : s
      )
    );
  };

  const handleClearChoice = (slotIdx: number) => {
    setChooseSlots(prev =>
      prev.map((s, i) => (i === slotIdx ? { ...s, selectedSpell: null } : s))
    );
  };

  const toggleExclude = (idx: number) => {
    setExcludedSpells(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleConfirm = () => {
    const spells: Spell[] = [];

    resolved.forEach((r, i) => {
      if (!excludedSpells.has(i)) {
        spells.push(r.spell);
      }
    });

    for (const slot of chooseSlots) {
      if (slot.selectedSpell) {
        spells.push(slot.selectedSpell);
      }
    }

    onConfirm(spells);
  };

  const includedCount =
    resolved.length -
    excludedSpells.size +
    chooseSlots.filter(s => s.selectedSpell).length;

  const filteredSpellsForSlot = (slot: ChooseSlot): ProcessedSpell[] => {
    const filter = parseChooseFilter(slot.choice.filter);
    const alreadyChosen = new Set(
      chooseSlots
        .filter(s => s.selectedSpell)
        .map(s => s.selectedSpell!.name.toLowerCase())
    );
    return filterSpellsByChooseFilter(allSpells, filter).filter(
      s => !alreadyChosen.has(s.name.toLowerCase())
    );
  };

  return (
    <>
      {/* Back button + group name */}
      {onBack && selectedGroupName && (
        <button
          type="button"
          onClick={onBack}
          className="text-accent-purple-text hover:text-accent-purple-text-muted flex items-center gap-1 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to spell lists
          <span className="text-muted ml-1">— {selectedGroupName}</span>
        </button>
      )}

      {/* Named/concrete spells */}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-heading text-sm font-semibold">Granted Spells</h4>
          <div className="space-y-1">
            {resolved.map((r, idx) => (
              <ResolvedSpellRow
                key={`${r.spell.name}-${idx}`}
                resolved={r}
                excluded={excludedSpells.has(idx)}
                onToggle={() => toggleExclude(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Unresolved spells */}
      {unresolved.length > 0 && (
        <div className="border-accent-orange-border bg-accent-orange-bg flex items-start gap-3 rounded-lg border p-3">
          <AlertTriangle className="text-accent-orange-text mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-body text-xs font-medium">
              Could not find in spell database:
            </p>
            <p className="text-muted text-xs">{unresolved.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Choose slots */}
      {chooseSlots.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-heading text-sm font-semibold">
            Choose {chooseSlots.length === 1 ? 'a Spell' : 'Spells'}
          </h4>
          {chooseSlots.map((slot, idx) => (
            <ChooseSlotRow
              key={idx}
              slot={slot}
              filteredSpells={filteredSpellsForSlot(slot)}
              spellsLoading={spellsLoading}
              onSelect={spell => handleChooseSelect(idx, spell)}
              onClear={() => handleClearChoice(idx)}
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="border-divider flex items-center justify-between border-t pt-4">
        <p className="text-muted text-xs">
          {includedCount} {includedCount === 1 ? 'spell' : 'spells'} will be
          added
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={includedCount === 0}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add {includedCount === 1 ? 'Spell' : 'Spells'}
          </Button>
        </div>
      </div>
    </>
  );
}

function ResolvedSpellRow({
  resolved,
  excluded,
  onToggle,
}: {
  resolved: ResolvedSpell;
  excluded: boolean;
  onToggle: () => void;
}) {
  const { spell, grantLabel } = resolved;
  const icon = SCHOOL_ICONS[spell.school] || '✨';

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
        excluded
          ? 'border-divider bg-surface-inset opacity-50'
          : 'border-accent-purple-border bg-surface-raised hover:bg-surface-hover'
      }`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          excluded
            ? 'border-divider-strong bg-surface-inset'
            : 'border-accent-purple-border bg-accent-purple-bg'
        }`}
      >
        {!excluded && <Check className="text-accent-purple-text h-3.5 w-3.5" />}
      </div>
      <span className="text-lg">{icon}</span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${excluded ? 'text-muted line-through' : 'text-heading'}`}
        >
          {spell.name}
        </p>
        <p className="text-muted text-xs">
          {spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`}
          {' • '}
          {spell.school}
        </p>
      </div>
      <span className="bg-accent-indigo-bg text-accent-indigo-text shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
        {grantLabel}
      </span>
    </button>
  );
}

function ChooseSlotRow({
  slot,
  filteredSpells,
  spellsLoading,
  onSelect,
  onClear,
}: {
  slot: ChooseSlot;
  filteredSpells: ProcessedSpell[];
  spellsLoading: boolean;
  onSelect: (spell: ProcessedSpell) => void;
  onClear: () => void;
}) {
  const label = grantTypeLabel(slot.choice.grantType, slot.choice.freeCastMax);

  return (
    <div className="border-divider bg-surface-raised space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-body text-xs font-medium">
          {slot.filterDescription}
        </p>
        <span className="bg-accent-indigo-bg text-accent-indigo-text rounded-full px-2 py-0.5 text-xs font-medium">
          {label}
        </span>
      </div>

      {slot.selectedSpell ? (
        <div className="border-accent-purple-border bg-accent-purple-bg flex items-center justify-between rounded-lg border px-3 py-2">
          <div className="flex items-center gap-2">
            <Check className="text-accent-purple-text h-4 w-4" />
            <span className="text-heading text-sm font-medium">
              {slot.selectedSpell.name}
            </span>
            <span className="text-muted text-xs">
              {slot.selectedSpell.level === 0
                ? 'Cantrip'
                : `Lvl ${slot.selectedSpell.level}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="text-muted hover:text-body rounded p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <SpellBrowseDropdown
          spells={filteredSpells}
          onSelect={onSelect}
          loading={spellsLoading}
          placeholder={`Browse ${slot.filterDescription.toLowerCase()}...`}
        />
      )}
    </div>
  );
}

const LEVEL_COLORS: Record<number, string> = {
  0: 'text-gray-500',
  1: 'text-blue-500',
  2: 'text-green-500',
  3: 'text-yellow-500',
  4: 'text-orange-500',
  5: 'text-red-500',
  6: 'text-purple-500',
  7: 'text-pink-500',
  8: 'text-cyan-500',
  9: 'text-white',
};

function SpellBrowseDropdown({
  spells,
  onSelect,
  loading,
  placeholder,
}: {
  spells: ProcessedSpell[];
  onSelect: (spell: ProcessedSpell) => void;
  loading: boolean;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  }>({ top: 0, left: 0, width: 0, openUp: false });

  const DROPDOWN_MAX_HEIGHT = 340;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;

    setPosition({
      top: openUp ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  }, []);

  const filtered = useMemo(() => {
    const sorted = [...spells].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.name.localeCompare(b.name);
    });
    if (!search.trim()) return sorted;

    const q = search.toLowerCase().trim();
    return sorted.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.schoolName.toLowerCase().includes(q)
    );
  }, [spells, search]);

  React.useEffect(() => {
    setHighlightedIdx(0);
  }, [filtered]);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
      setSearch('');
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  React.useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const highlighted = listRef.current.children[highlightedIdx] as HTMLElement;
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIdx, isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightedIdx]) {
          onSelect(filtered[highlightedIdx]);
          setIsOpen(false);
          setSearch('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
    }
  };

  const dropdownContent = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          className="border-divider-strong bg-surface-raised overflow-hidden rounded-lg border-2 shadow-lg"
          style={{
            position: 'fixed',
            zIndex: 9999,
            left: position.left,
            width: position.width,
            maxHeight: DROPDOWN_MAX_HEIGHT,
            ...(position.openUp
              ? { bottom: window.innerHeight - position.top }
              : { top: position.top }),
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="border-divider shrink-0 border-b p-2">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Filter spells..."
              className="border-divider bg-surface-inset text-heading placeholder:text-muted w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none"
              autoComplete="off"
            />
          </div>

          <ul ref={listRef} className="flex-1 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((spell, idx) => (
                <li key={spell.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(spell);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      idx === highlightedIdx
                        ? 'bg-accent-purple-bg'
                        : 'hover:bg-surface-hover'
                    )}
                  >
                    <span className="text-base">
                      {SCHOOL_ICONS[spell.schoolName] || '✨'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-heading truncate text-sm font-medium">
                        {spell.name}
                      </p>
                      <p className="text-muted text-xs">
                        <span className={LEVEL_COLORS[spell.level]}>
                          {spell.level === 0
                            ? 'Cantrip'
                            : `Level ${spell.level}`}
                        </span>
                        {' · '}
                        {spell.schoolName}
                        {' · '}
                        <span className="text-faint">{spell.source}</span>
                      </p>
                    </div>
                  </button>
                </li>
              ))
            ) : (
              <li className="text-muted px-3 py-4 text-center text-sm">
                No spells match your search
              </li>
            )}
          </ul>

          <div className="border-divider text-muted shrink-0 border-t px-3 py-1.5 text-xs">
            {filtered.length} {filtered.length === 1 ? 'spell' : 'spells'}
            {search && ' matching'}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen(prev => !prev);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cn(
          'border-divider-strong text-heading flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors',
          isOpen
            ? 'border-accent-purple-border-strong ring-accent-purple-bg/20 ring-2'
            : 'hover:border-divider-strong'
        )}
      >
        <span className="text-muted">
          {loading ? 'Loading spells...' : placeholder}
        </span>
        <ChevronRight
          className={cn(
            'text-muted h-4 w-4 transition-transform',
            isOpen && 'rotate-90'
          )}
        />
      </button>
      {dropdownContent}
    </div>
  );
}
