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
  'Lawful Good', 'Neutral Good', 'Chaotic Good',
  'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
  'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
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
  className = ''
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
              className="w-12 h-12 rounded-full border-2 border-blue-200"
              width={48}
              height={48}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-800 truncate">
              {name || 'Unnamed Character'}
            </h3>
            <div className="text-sm text-gray-600 truncate">
              {level && classInfo?.name && (
                <span>Level {level} {classInfo.name}</span>
              )}
              {race && (
                <span>{level && classInfo?.name ? ' • ' : ''}{race}</span>
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
      <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
        Character Information
      </h2>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Character Name */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Character Name</label>
          {readonly ? (
            <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-800">
              {name || 'Unnamed Character'}
            </div>
          ) : (
            <input 
              type="text" 
              placeholder="Enter character name"
              value={name}
              onChange={(e) => onUpdateName?.(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
            />
          )}
        </div>

        {/* Race */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Race</label>
          {readonly ? (
            <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-800">
              {race || 'Unknown'}
            </div>
          ) : (
            <input 
              type="text" 
              placeholder="Human"
              value={race}
              onChange={(e) => onUpdateRace?.(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
            />
          )}
        </div>

        {/* Class & Level (Display Only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class & Level</label>
          <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-800">
            {level && classInfo?.name ? `Level ${level} ${classInfo.name}` : 'Not Set'}
          </div>
        </div>

        {/* Background */}
        {showBackground && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
            {readonly ? (
              <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-800">
                {background || 'Unknown'}
              </div>
            ) : (
              <input 
                type="text" 
                placeholder="Soldier"
                value={background}
                onChange={(e) => onUpdateBackground?.(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
              />
            )}
          </div>
        )}

        {/* Player Name */}
        {showPlayerName && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Player Name</label>
            {readonly ? (
              <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-800">
                {playerName || 'Unknown'}
              </div>
            ) : (
              <input 
                type="text" 
                placeholder="Your Name"
                value={playerName}
                onChange={(e) => onUpdatePlayerName?.(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
              />
            )}
          </div>
        )}

        {/* Alignment */}
        {showAlignment && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alignment</label>
            {readonly ? (
              <div className="w-full p-2 bg-gray-50 border border-gray-200 rounded-md text-gray-800">
                {alignment || 'Unknown'}
              </div>
            ) : (
              <select 
                value={alignment}
                onChange={(e) => onUpdateAlignment?.(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
              >
                <option value="">Select...</option>
                {ALIGNMENTS.map(align => (
                  <option key={align} value={align}>{align}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
