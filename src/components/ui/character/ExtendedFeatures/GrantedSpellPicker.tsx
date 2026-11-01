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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/feedback/dialog';
import { Button, Input } from '@/components/ui/forms';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
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
import { Check, AlertTriangle, X, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  AppIcon,
  SPELL_SCHOOL_ICONS,
  getIconName,
} from '@/components/ui/icons';

interface GrantedSpellPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (spells: Spell[]) => void;
  featName: string;
  parsed: ParsedAdditionalSpells;
  allSpells: ProcessedSpell[];
  spellsLoading: boolean;
}

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
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Feat grants spells</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-6">
            <div className="border-divider border-b pb-4">
              <div>
                <p className="text-heading text-sm font-medium">
                  <strong>{featName}</strong> grants spells to your character.
                </p>
                <p className="text-muted mt-1 text-xs">
                  {showGroupPicker
                    ? 'First, choose which spell list you want to pick from.'
                    : "Uncheck any spell you don't want, then add the rest."}
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
        </DialogBody>
      </DialogContent>
    </Dialog>
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
              className="border-divider hover:bg-surface-hover flex min-h-11 w-full items-center gap-3 border-b py-3 text-left transition-colors"
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
        <Button type="button" onClick={onBack} variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4" />
          Back to spell lists
          <span className="text-muted ml-1">— {selectedGroupName}</span>
        </Button>
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
        <div className="border-ember-border bg-ember-bg flex items-start gap-3 rounded-sm border p-3">
          <AlertTriangle className="text-ember-text mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-body text-xs font-medium">
              Couldn&apos;t find these spells. Add them on the Spells tab:
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
            {includedCount === 1
              ? 'Add 1 spell'
              : `Add ${includedCount} spells`}
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
  const icon = getIconName(SPELL_SCHOOL_ICONS, spell.school, 'spell');

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={!excluded}
      onClick={onToggle}
      className={`border-divider hover:bg-surface-hover flex min-h-11 w-full items-center gap-3 border-b py-3 text-left transition-colors ${
        excluded ? 'opacity-50' : ''
      }`}
    >
      <div
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
          excluded
            ? 'border-divider-strong bg-surface-inset'
            : 'border-brass-border bg-brass-fill'
        }`}
      >
        {!excluded && <Check className="text-on-brass h-3.5 w-3.5" />}
      </div>
      <AppIcon name={icon} className="h-5 w-5 shrink-0" />
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
      <span className="text-muted shrink-0 text-xs">{grantLabel}</span>
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
    <div className="border-divider space-y-2 border-b py-3">
      <div className="flex items-center justify-between">
        <p className="text-body text-xs font-medium">
          {slot.filterDescription}
        </p>
        <span className="text-muted text-xs">{label}</span>
      </div>

      {slot.selectedSpell ? (
        <div className="border-divider flex items-center justify-between border-b py-2">
          <div className="flex items-center gap-2">
            <Check className="text-brass-text h-4 w-4" />
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
            aria-label="Clear selected spell"
            onClick={onClear}
            className="text-muted hover:text-body flex size-8 items-center justify-center rounded-sm pointer-coarse:size-11"
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
    bottom: number;
    left: number;
    width: number;
    openUp: boolean;
  }>({ top: 0, bottom: 0, left: 0, width: 0, openUp: false });

  const DROPDOWN_MAX_HEIGHT = 340;

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dialog = triggerRef.current.closest('[role="dialog"]');
    if (!dialog) return;
    const dialogRect = dialog.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT && spaceAbove > spaceBelow;

    setPosition({
      top: rect.bottom - dialogRect.top + 4,
      bottom: dialogRect.bottom - rect.top + 4,
      left: rect.left - dialogRect.left,
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

  const dialogElement = triggerRef.current?.closest('[role="dialog"]');
  const dropdownContent =
    isOpen && dialogElement
      ? createPortal(
          <div
            ref={dropdownRef}
            className={`${OVERLAY_SURFACE} overflow-hidden`}
            style={{
              position: 'absolute',
              zIndex: 9999,
              left: position.left,
              width: position.width,
              maxHeight: DROPDOWN_MAX_HEIGHT,
              ...(position.openUp
                ? { bottom: position.bottom }
                : { top: position.top }),
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div className="border-divider shrink-0 border-b p-2">
              <Input
                ref={inputRef}
                type="text"
                aria-label="Filter spells"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Filter spells"
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
                          ? 'bg-surface-hover'
                          : 'hover:bg-surface-hover'
                      )}
                    >
                      <AppIcon
                        name={getIconName(
                          SPELL_SCHOOL_ICONS,
                          spell.schoolName,
                          'spell'
                        )}
                        className="h-5 w-5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-heading text-sm font-medium break-words">
                          {spell.name}
                        </p>
                        <p className="text-muted text-xs">
                          <span className="text-muted">
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
          dialogElement
        )
      : null;

  return (
    <div>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="md"
        fullWidth
        selected={isOpen}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen(prev => !prev);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="justify-between"
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
      </Button>
      {dropdownContent}
    </div>
  );
}
