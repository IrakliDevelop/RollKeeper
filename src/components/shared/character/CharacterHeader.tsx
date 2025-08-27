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
    ? `bg-white rounded-lg shadow border border-amber-200 p-3 ${className}`
    : `bg-white rounded-lg shadow-lg border border-amber-200 p-6 ${className}`;

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
            <h3 className="truncate text-lg font-bold text-gray-800">
              {name || 'Unnamed Character'}
            </h3>
            <div className="truncate text-sm text-gray-600">
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
                <span className="text-gray-500"> ({playerName})</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
        Character Information
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Character Name */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Character Name
          </label>
          {readonly ? (
            <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-800">
              {name || 'Unnamed Character'}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Enter character name"
              value={name}
              onChange={e => onUpdateName?.(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Race */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Race
          </label>
          {readonly ? (
            <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-800">
              {race || 'Unknown'}
            </div>
          ) : (
            <input
              type="text"
              placeholder="Human"
              value={race}
              onChange={e => onUpdateRace?.(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* Class & Level (Display Only) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Class & Level
          </label>
          <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-800">
            {level && classInfo?.name
              ? `Level ${level} ${classInfo.name}`
              : 'Not Set'}
          </div>
        </div>

        {/* Background */}
        {showBackground && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Background
            </label>
            {readonly ? (
              <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-800">
                {background || 'Unknown'}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Soldier"
                value={background}
                onChange={e => onUpdateBackground?.(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        )}

        {/* Player Name */}
        {showPlayerName && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Player Name
            </label>
            {readonly ? (
              <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-800">
                {playerName || 'Unknown'}
              </div>
            ) : (
              <input
                type="text"
                placeholder="Your Name"
                value={playerName}
                onChange={e => onUpdatePlayerName?.(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 text-gray-800 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        )}

        {/* Alignment */}
        {showAlignment && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Alignment
            </label>
            {readonly ? (
              <div className="w-full rounded-md border border-gray-200 bg-gray-50 p-2 text-gray-800">
                {alignment || 'Unknown'}
              </div>
            ) : (
              <select
                value={alignment}
                onChange={e => onUpdateAlignment?.(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
