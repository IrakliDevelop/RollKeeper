'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Users, User, Heart, Skull, EyeOff, Shield } from 'lucide-react';
import { useDraggableY } from '@/hooks/useDraggableY';
import {
  getHpBarColor,
  getHpNumberColor,
  getHpTierTextColor,
} from '@/utils/hpColor';
import { hpPercent, hpStatus, hpTier, HP_STATUS_LABELS } from '@/utils/hpState';
import { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';
import { Badge } from '@/components/ui/layout/badge';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { Tooltip, TooltipProvider } from '@/components/ui/primitives/Tooltip';

const STORAGE_KEY = 'rollkeeper-party-hp-sidebar';
const POS_KEY = 'rollkeeper-party-hp-sidebar-y';

function DeathSavesDisplay({
  deathSaves,
}: {
  deathSaves: { successes: number; failures: number; isStabilized: boolean };
}) {
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        <span className="type-small text-muted">S</span>
        {[0, 1, 2].map(i => (
          <div
            key={`s-${i}`}
            className={`h-2 w-2 rounded-full border ${
              i < deathSaves.successes
                ? 'border-verdigris-border bg-verdigris-fill'
                : 'border-divider bg-surface-secondary'
            }`}
          />
        ))}
      </div>
      <div className="flex items-center gap-0.5">
        <span className="type-small text-muted">F</span>
        {[0, 1, 2].map(i => (
          <div
            key={`f-${i}`}
            className={`h-2 w-2 rounded-full border ${
              i < deathSaves.failures
                ? 'border-blood-border bg-blood-fill'
                : 'border-divider bg-surface-secondary'
            }`}
          />
        ))}
      </div>
      {deathSaves.isStabilized && (
        <span className="type-small text-verdigris-text font-medium">
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
              alt=""
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
          <div className="type-ui text-heading truncate font-medium">
            {member.characterName}
          </div>
          <div className="type-small text-muted truncate">
            {member.className} {member.level}
          </div>
        </div>
      </div>

      {/* AC + HP Section */}
      <div className="mb-1 flex items-center gap-1.5">
        <Shield size={11} className="text-muted flex-shrink-0" aria-hidden />
        <span className="type-small text-body font-medium">
          {member.armorClass}
        </span>
      </div>

      {hp === null ? (
        <div className="type-small text-muted flex items-center gap-1.5">
          <EyeOff size={11} aria-hidden />
          HP hidden
        </div>
      ) : isDown ? (
        <div>
          <div className="flex items-center gap-1.5">
            <Skull size={12} className="text-blood-text" aria-hidden />
            <span className="type-small text-blood-text font-medium">
              {HP_STATUS_LABELS.down} ({hp.current}/{hp.max})
            </span>
          </div>
          {hp.deathSaves && <DeathSavesDisplay deathSaves={hp.deathSaves} />}
        </div>
      ) : (
        <div>
          {/* HP Bar */}
          <div className="mb-0.5 flex items-center gap-2">
            <Heart size={11} className="text-muted flex-shrink-0" aria-hidden />
            <span className="bg-divider block h-1 flex-1">
              <span
                className={`block h-full transition-[width] ${getHpBarColor(hp.current, hp.max)}`}
                style={{
                  width: `${hp.max > 0 ? Math.min(100, (hp.current / hp.max) * 100) : 0}%`,
                }}
              />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1 pl-5">
            <span
              className={`${getHpNumberColor(hp.current, hp.max)} type-small font-medium`}
            >
              {hp.current}/{hp.max}
            </span>
            <span
              className={`${getHpTierTextColor(hpTier(hpPercent(hp.current, hp.max)))} type-small`}
            >
              {HP_STATUS_LABELS[hpStatus(hp.current, hp.max)]}
            </span>
            {hp.temporary > 0 && (
              <Badge
                variant="neutral"
                size="sm"
                className="type-small text-frost-text"
              >
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
  partyMembers: PartyMemberHP[];
  loading: boolean;
}

/**
 * Presentational — the party-sync polling instance lives one level up
 * (page-level `usePartySync`) so the sidebar and the initiative panel share
 * ONE poll/poke-fed data source instead of each running its own; a second
 * instance here would never see poke-driven refreshes and would double the
 * polling traffic.
 */
export function PartyHPSidebar({
  campaignCode,
  partyMembers,
  loading,
}: PartyHPSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { topPx, containerRef: sidebarRef, startDrag } = useDraggableY(POS_KEY);

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
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    },
    [sidebarRef]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () =>
        document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen, handleOutsideClick]);

  // Don't render anything if not in a campaign
  if (!campaignCode) return null;

  const handleLabel = isOpen ? 'Hide party HP' : 'Show party HP';

  return (
    <TooltipProvider>
      <div
        ref={sidebarRef}
        className={`fixed left-0 z-[55] hidden lg:flex ${
          topPx === null ? 'top-1/2 -translate-y-1/2' : ''
        }`}
        style={topPx !== null ? { top: topPx } : undefined}
      >
        {/* Panel Wrapper — collapses width when closed */}
        <div
          className={`overflow-hidden transition-[width] duration-180 ease-out ${
            isOpen ? `${OVERLAY_SURFACE} rounded-l-none border-l-0` : ''
          }`}
          style={{ width: isOpen ? '241px' : '0px' }}
        >
          <div className="max-h-[70vh] w-[240px] overflow-hidden">
            {/* Header — also the vertical drag handle */}
            <div
              onPointerDown={startDrag}
              className="border-divider cursor-grab touch-none border-b px-3 py-2.5 select-none active:cursor-grabbing"
            >
              <div className="type-ui text-heading flex items-center gap-2 font-semibold">
                <Users size={14} className="text-muted" aria-hidden />
                Party HP
                <span className="text-muted font-normal">
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
                <div className="type-small text-muted px-3 py-4 text-center">
                  Loading party…
                </div>
              ) : partyMembers.length === 0 ? (
                <div className="type-small text-muted px-3 py-4 text-center">
                  No party members synced
                </div>
              ) : (
                partyMembers.map(member => (
                  <PartyMemberRow key={member.characterId} member={member} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Toggle handle */}
        <Tooltip content={handleLabel} side="right">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={handleLabel}
            aria-expanded={isOpen}
            className={`flex flex-col items-center gap-1 self-center rounded-md rounded-l-none border border-l-0 px-2.5 py-5 transition-colors pointer-coarse:min-w-11 ${
              isOpen
                ? 'border-divider bg-surface-elevated text-heading'
                : 'border-divider bg-surface-elevated text-muted hover:text-body'
            }`}
          >
            <Users size={20} aria-hidden />
            {!isOpen && partyMembers.length > 0 && (
              <span className="type-small font-semibold tabular-nums">
                {partyMembers.length}
              </span>
            )}
          </button>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
