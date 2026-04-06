'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Users, User, Heart, Skull, EyeOff, Shield } from 'lucide-react';
import { usePartySync } from '@/hooks/usePartySync';
import { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { Badge } from '@/components/ui/layout/badge';

const STORAGE_KEY = 'rollkeeper-party-hp-sidebar';

function getHpBarColor(current: number, max: number): string {
  if (max === 0) return 'bg-surface-secondary';
  const pct = current / max;
  if (pct > 0.5) return 'bg-green-600 dark:bg-green-500';
  if (pct > 0.25) return 'bg-amber-500 dark:bg-amber-400';
  return 'bg-red-600 dark:bg-red-500';
}

function DeathSavesDisplay({
  deathSaves,
}: {
  deathSaves: { successes: number; failures: number; isStabilized: boolean };
}) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        <span className="text-faint text-xs">S</span>
        {[0, 1, 2].map(i => (
          <div
            key={`s-${i}`}
            className={`h-2 w-2 rounded-full border ${
              i < deathSaves.successes
                ? 'border-green-600 bg-green-500'
                : 'border-divider bg-surface-secondary'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        <span className="text-faint text-xs">F</span>
        {[0, 1, 2].map(i => (
          <div
            key={`f-${i}`}
            className={`h-2 w-2 rounded-full border ${
              i < deathSaves.failures
                ? 'border-red-600 bg-red-500'
                : 'border-divider bg-surface-secondary'
            }`}
          />
        ))}
      </div>
      {deathSaves.isStabilized && (
        <span className="text-accent-emerald-text text-xs font-medium">
          Stable
        </span>
      )}
    </div>
  );
}

function PartyMemberRow({ member }: { member: PartyMemberHP }) {
  const hp = member.hitPoints;
  const isDown = hp !== null && hp.current <= 0;

  return (
    <div className="border-divider border-b px-3 py-3 last:border-b-0">
      {/* Avatar + Name + Class */}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="bg-surface-secondary relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full">
          {member.avatar ? (
            <Image
              src={member.avatar}
              alt={member.characterName}
              fill
              className="object-cover"
              sizes="28px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User size={14} className="text-muted" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-heading truncate text-sm leading-tight font-medium">
            {member.characterName}
          </div>
          <div className="text-muted truncate text-xs">
            {member.className} {member.level}
          </div>
        </div>
      </div>

      {/* AC + HP Section */}
      <div className="mb-1 flex items-center gap-1.5">
        <Shield size={11} className="text-accent-blue-text flex-shrink-0" />
        <span className="text-body text-xs font-medium">
          {member.armorClass}
        </span>
      </div>

      {hp === null ? (
        <div className="text-faint flex items-center gap-1.5 text-xs">
          <EyeOff size={11} />
          HP hidden
        </div>
      ) : isDown ? (
        <div>
          <div className="flex items-center gap-1.5">
            <Skull size={12} className="text-accent-red-text" />
            <span className="text-accent-red-text text-xs font-medium">
              Down ({hp.current}/{hp.max})
            </span>
          </div>
          {hp.deathSaves && <DeathSavesDisplay deathSaves={hp.deathSaves} />}
        </div>
      ) : (
        <div>
          {/* HP Bar */}
          <div className="mb-0.5 flex items-center gap-2">
            <Heart size={11} className="text-muted flex-shrink-0" />
            <div className="bg-surface-secondary h-2 flex-1 overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full transition-all ${getHpBarColor(hp.current, hp.max)}`}
                style={{
                  width: `${hp.max > 0 ? Math.min(100, (hp.current / hp.max) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1 pl-5">
            <span className="text-body text-xs font-medium">
              {hp.current}/{hp.max}
            </span>
            {hp.temporary > 0 && (
              <Badge variant="info" size="sm" className="text-xs">
                +{hp.temporary}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PartyHPSidebarProps {
  campaignCode: string | null;
  currentCharacterId: string;
}

export function PartyHPSidebar({
  campaignCode,
  currentCharacterId,
}: PartyHPSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { partyMembers, loading } = usePartySync({
    campaignCode,
    currentCharacterId,
  });

  // Load persisted open state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setIsOpen(true);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Persist open state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    } catch {
      // Ignore localStorage errors
    }
  }, [isOpen]);

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () =>
        document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen, handleOutsideClick]);

  // Don't render anything if not in a campaign
  if (!campaignCode) return null;

  return (
    <div
      ref={sidebarRef}
      className="fixed top-1/2 left-0 z-[55] hidden -translate-y-1/2 lg:flex"
    >
      {/* Panel Wrapper — collapses width when closed */}
      <div
        className="overflow-hidden transition-[width] duration-300 ease-in-out"
        style={{ width: isOpen ? '240px' : '0px' }}
      >
        <div className="border-divider bg-surface-raised max-h-[70vh] w-[240px] overflow-hidden rounded-r-xl border-y-2 border-r-2 shadow-lg">
          {/* Header */}
          <div className="border-divider border-b px-3 py-2.5">
            <div className="text-heading flex items-center gap-2 text-sm font-semibold">
              <Users size={14} className="text-accent-blue-text" />
              Party HP
              <span className="text-faint text-xs font-normal">
                ({partyMembers.length})
              </span>
            </div>
          </div>

          {/* Members List */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: 'calc(70vh - 40px)' }}
          >
            {loading ? (
              <div className="text-muted px-3 py-4 text-center text-sm">
                Loading...
              </div>
            ) : partyMembers.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <Users size={20} className="text-faint mx-auto mb-1.5" />
                <div className="text-muted text-xs">
                  No party members synced
                </div>
              </div>
            ) : (
              partyMembers.map(member => (
                <PartyMemberRow key={member.characterId} member={member} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative self-center rounded-r-lg border-y-2 border-r-2 px-1.5 py-3 shadow-md transition-colors ${
          isOpen
            ? 'border-accent-blue-border bg-accent-blue-bg text-accent-blue-text'
            : 'border-divider bg-surface-raised text-muted hover:text-body hover:bg-surface-secondary'
        }`}
        title={isOpen ? 'Hide party HP' : 'Show party HP'}
      >
        <Users size={16} />
        {!isOpen && partyMembers.length > 0 && (
          <div className="bg-accent-blue-bg text-accent-blue-text border-accent-blue-border absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border text-xs font-bold">
            {partyMembers.length}
          </div>
        )}
      </button>
    </div>
  );
}
