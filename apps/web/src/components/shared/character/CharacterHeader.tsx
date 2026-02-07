'use client';

import React from 'react';
import { ClassInfo } from '@/types/character';
import Image from 'next/image';

interface CharacterHeaderProps {
  name: string;
  race?: string;
  classInfo?: ClassInfo;
  level?: number;
  background?: string;
  playerName?: string;
  alignment?: string;
  avatar?: string;

  // Display options
  compact?: boolean;
  showPlayerName?: boolean;
  showBackground?: boolean;
  showAlignment?: boolean;
  readonly?: boolean;

  // Edit handlers
  onUpdateName?: (name: string) => void;
  onUpdateRace?: (race: string) => void;
  onUpdateBackground?: (background: string) => void;
  onUpdatePlayerName?: (playerName: string) => void;
  onUpdateAlignment?: (alignment: string) => void;

  className?: string;
}

const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'True Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
];

export function CharacterHeader({
  name,
  race,
  classInfo,
  level,
  background,
  playerName,
  alignment,
  avatar,
  compact = false,
  showPlayerName = false,
  showBackground = true,
  showAlignment = true,
  readonly = false,
  onUpdateName,
  onUpdateRace,
  onUpdateBackground,
  onUpdatePlayerName,
  onUpdateAlignment,
  className = '',
}: CharacterHeaderProps) {
  const containerClasses = compact
    ? `bg-surface-raised rounded-lg shadow border border-accent-amber-border p-3 ${className}`
    : `bg-surface-raised rounded-lg shadow-lg border border-accent-amber-border p-6 ${className}`;

  if (compact) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center gap-3">
          {avatar && (
            <Image
              src={avatar}
              alt={name || 'Character'}
              className="h-12 w-12 rounded-full border-2 border-blue-200"
              width={48}
              height={48}
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-heading truncate text-lg font-bold">
              {name || 'Unnamed Character'}
            </h3>
            <div className="text-muted truncate text-sm">
              {level && classInfo?.name && (
                <span>
                  Level {level} {classInfo.name}
                </span>
              )}
              {race && (
                <span>
                  {level && classInfo?.name ? ' • ' : ''}
                  {race}
                </span>
              )}
              {showPlayerName && playerName && (
                <span className="text-faint"> ({playerName})</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <h2 className="border-divider text-heading mb-4 border-b pb-2 text-lg font-bold">
        Character Information
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Character Name */}
        <div className="sm:col-span-2">
          <label className="text-body mb-1 block text-sm font-medium">
            Character Name
          </label>
          {readonly ? (
            <div className="border-divider bg-surface-inset text-heading w-full rounded-md border p-2">
              {name || 'Unnamed Character'}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Enter character name"
              value={name}
              onChange={e => onUpdateName?.(e.target.value)}
              className="border-divider-strong bg-surface-raised text-heading placeholder-muted focus:ring-accent-blue-border-strong w-full rounded-md border p-2 focus:border-transparent focus:ring-2"
            />
          )}
        </div>

        {/* Race */}
        <div>
          <label className="text-body mb-1 block text-sm font-medium">
            Race
          </label>
          {readonly ? (
            <div className="border-divider bg-surface-inset text-heading w-full rounded-md border p-2">
              {race || 'Unknown'}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Human"
              value={race}
              onChange={e => onUpdateRace?.(e.target.value)}
              className="border-divider-strong bg-surface-raised text-heading placeholder-muted focus:ring-accent-blue-border-strong w-full rounded-md border p-2 focus:border-transparent focus:ring-2"
            />
          )}
        </div>

        {/* Class & Level (Display Only) */}
        <div>
          <label className="text-body mb-1 block text-sm font-medium">
            Class & Level
          </label>
          <div className="border-divider bg-surface-inset text-heading w-full rounded-md border p-2">
            {level && classInfo?.name
              ? `Level ${level} ${classInfo.name}`
              : 'Not Set'}
          </div>
        </div>

        {/* Background */}
        {showBackground && (
          <div>
            <label className="text-body mb-1 block text-sm font-medium">
              Background
            </label>
            {readonly ? (
              <div className="border-divider bg-surface-inset text-heading w-full rounded-md border p-2">
                {background || 'Unknown'}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Soldier"
                value={background}
                onChange={e => onUpdateBackground?.(e.target.value)}
                className="border-divider-strong bg-surface-raised text-heading placeholder-muted focus:ring-accent-blue-border-strong w-full rounded-md border p-2 focus:border-transparent focus:ring-2"
              />
            )}
          </div>
        )}

        {/* Player Name */}
        {showPlayerName && (
          <div>
            <label className="text-body mb-1 block text-sm font-medium">
              Player Name
            </label>
            {readonly ? (
              <div className="border-divider bg-surface-inset text-heading w-full rounded-md border p-2">
                {playerName || 'Unknown'}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Your Name"
                value={playerName}
                onChange={e => onUpdatePlayerName?.(e.target.value)}
                className="border-divider-strong bg-surface-raised text-heading placeholder-muted focus:ring-accent-blue-border-strong w-full rounded-md border p-2 focus:border-transparent focus:ring-2"
              />
            )}
          </div>
        )}

        {/* Alignment */}
        {showAlignment && (
          <div>
            <label className="text-body mb-1 block text-sm font-medium">
              Alignment
            </label>
            {readonly ? (
              <div className="border-divider bg-surface-inset text-heading w-full rounded-md border p-2">
                {alignment || 'Unknown'}
              </div>
            ) : (
              <select
                value={alignment}
                onChange={e => onUpdateAlignment?.(e.target.value)}
                className="border-divider-strong bg-surface-raised text-heading focus:ring-accent-blue-border-strong w-full rounded-md border p-2 focus:border-transparent focus:ring-2"
              >
                <option value="">Select...</option>
                {ALIGNMENTS.map(align => (
                  <option key={align} value={align}>
                    {align}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
