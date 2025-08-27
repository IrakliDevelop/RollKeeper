'use client';

import React, { useState, useMemo } from 'react';
import {
  Scroll,
  Filter,
  ChevronDown,
  ChevronRight,
  Trash2,
  Download,
  Clock,
  Sword,
  Heart,
  Zap,
  Skull,
  RotateCcw,
} from 'lucide-react';
import { CombatLogEntry } from '@/types/combat';

interface CombatLogProps {
  entries: CombatLogEntry[];
  currentRound: number;
  onClear: () => void;
  onExport?: () => void;
  compact?: boolean;
  className?: string;
}

type LogFilter =
  | 'all'
  | 'damage'
  | 'healing'
  | 'death'
  | 'action'
  | 'initiative'
  | 'turn'
  | 'round';

export function CombatLog({
  entries,
  currentRound,
  onClear,
  onExport,
  compact = false,
  className = '',
}: CombatLogProps) {
  const [selectedFilter, setSelectedFilter] = useState<LogFilter>('all');
  const [collapsedRounds, setCollapsedRounds] = useState<Set<number>>(
    new Set()
  );
  const [showFilters, setShowFilters] = useState(false);

  // Group entries by round
  const groupedEntries = useMemo(() => {
    const filtered =
      selectedFilter === 'all'
        ? entries
        : entries.filter(entry => entry.type === selectedFilter);

    const grouped = filtered.reduce(
      (acc, entry) => {
        const round = entry.round;
        if (!acc[round]) {
          acc[round] = [];
        }
        acc[round].push(entry);
        return acc;
      },
      {} as Record<number, CombatLogEntry[]>
    );

    // Sort entries within each round by timestamp
    Object.keys(grouped).forEach(round => {
      grouped[parseInt(round)].sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    });

    return grouped;
  }, [entries, selectedFilter]);

  const sortedRounds = Object.keys(groupedEntries)
    .map(round => parseInt(round))
    .sort((a, b) => b - a); // Most recent round first

  const toggleRoundCollapse = (round: number) => {
    setCollapsedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(round)) {
        newSet.delete(round);
      } else {
        newSet.add(round);
      }
      return newSet;
    });
  };

  const getEntryIcon = (type: CombatLogEntry['type']) => {
    switch (type) {
      case 'damage':
        return <Sword size={14} className="text-red-500" />;
      case 'healing':
        return <Heart size={14} className="text-green-500" />;
      case 'death':
        return <Skull size={14} className="text-gray-600" />;
      case 'condition':
        return <Zap size={14} className="text-yellow-500" />;
      case 'initiative':
        return <RotateCcw size={14} className="text-purple-500" />;
      case 'turn':
        return <ChevronRight size={14} className="text-blue-500" />;
      case 'round':
        return <Clock size={14} className="text-indigo-500" />;
      default:
        return <Scroll size={14} className="text-gray-500" />;
    }
  };

  const getEntryColor = (type: CombatLogEntry['type']) => {
    switch (type) {
      case 'damage':
        return 'border-l-red-400 bg-red-50';
      case 'healing':
        return 'border-l-green-400 bg-green-50';
      case 'death':
        return 'border-l-gray-400 bg-gray-50';
      case 'condition':
        return 'border-l-yellow-400 bg-yellow-50';
      case 'initiative':
        return 'border-l-purple-400 bg-purple-50';
      case 'turn':
        return 'border-l-blue-400 bg-blue-50';
      case 'round':
        return 'border-l-indigo-400 bg-indigo-50';
      default:
        return 'border-l-gray-300 bg-white';
    }
  };

  const filterOptions: {
    value: LogFilter;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: 'all', label: 'All', icon: <Scroll size={14} /> },
    {
      value: 'damage',
      label: 'Damage',
      icon: <Sword size={14} className="text-red-500" />,
    },
    {
      value: 'healing',
      label: 'Healing',
      icon: <Heart size={14} className="text-green-500" />,
    },
    {
      value: 'death',
      label: 'Deaths',
      icon: <Skull size={14} className="text-gray-600" />,
    },
    {
      value: 'action',
      label: 'Actions',
      icon: <Zap size={14} className="text-yellow-500" />,
    },
    {
      value: 'turn',
      label: 'Turns',
      icon: <ChevronRight size={14} className="text-blue-500" />,
    },
  ];

  const containerClasses = compact
    ? `bg-white rounded-lg border border-gray-200 ${className}`
    : `bg-white rounded-lg shadow-lg border border-gray-200 ${className}`;

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scroll size={compact ? 16 : 20} className="text-purple-600" />
            <h3
              className={`font-bold text-purple-800 ${compact ? 'text-base' : 'text-lg'}`}
            >
              Combat Log
            </h3>
            {entries.length > 0 && (
              <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                {entries.length} entries
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-lg p-2 transition-colors ${
                showFilters
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Filter entries"
            >
              <Filter size={16} />
            </button>

            {/* Export Button */}
            {onExport && (
              <button
                onClick={onExport}
                className="rounded-lg bg-gray-100 p-2 text-gray-600 transition-colors hover:bg-gray-200"
                title="Export log"
              >
                <Download size={16} />
              </button>
            )}

            {/* Clear Button */}
            <button
              onClick={onClear}
              className="rounded-lg bg-red-100 p-2 text-red-600 transition-colors hover:bg-red-200"
              title="Clear log"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedFilter(option.value)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${
                    selectedFilter === option.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Log Entries */}
      <div className={`${compact ? 'max-h-64' : 'max-h-96'} overflow-y-auto`}>
        {sortedRounds.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <Scroll size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No combat actions yet</p>
            <p className="mt-1 text-xs text-gray-400">
              Actions will appear here as combat progresses
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4">
            {sortedRounds.map(round => {
              const roundEntries = groupedEntries[round];
              const isCollapsed = collapsedRounds.has(round);
              const isCurrentRound = round === currentRound;

              return (
                <div key={round} className="space-y-2">
                  {/* Round Header */}
                  <button
                    onClick={() => toggleRoundCollapse(round)}
                    className={`flex w-full items-center justify-between rounded-lg p-2 transition-colors ${
                      isCurrentRound
                        ? 'border border-blue-300 bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCollapsed ? (
                        <ChevronRight size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                      <span className="font-medium">
                        Round {round}
                        {isCurrentRound && (
                          <span className="ml-2 text-xs">(Current)</span>
                        )}
                      </span>
                      <span className="rounded-full bg-white/60 px-2 py-1 text-xs">
                        {roundEntries.length} actions
                      </span>
                    </div>
                  </button>

                  {/* Round Entries */}
                  {!isCollapsed && (
                    <div className="ml-4 space-y-1">
                      {roundEntries.map(entry => (
                        <div
                          key={entry.id}
                          className={`flex items-start gap-3 rounded-lg border-l-4 p-2 ${getEntryColor(entry.type)}`}
                        >
                          <div className="mt-0.5 flex-shrink-0">
                            {getEntryIcon(entry.type)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900">
                              {entry.description}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                              <span>
                                {new Date(entry.timestamp).toLocaleTimeString()}
                              </span>
                              {entry.target && entry.target !== entry.actor && (
                                <span>→ {entry.target}</span>
                              )}
                              {entry.amount && (
                                <span className="font-medium">
                                  ({entry.amount})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      {entries.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>
              {sortedRounds.length} round{sortedRounds.length !== 1 ? 's' : ''}{' '}
              • {entries.length} total actions
            </span>
            <span>
              Filter:{' '}
              {filterOptions.find(f => f.value === selectedFilter)?.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
