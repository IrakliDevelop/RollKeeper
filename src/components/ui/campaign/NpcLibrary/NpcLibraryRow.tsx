'use client';
import { useId } from 'react';
import Image from 'next/image';
import {
  Copy,
  ArrowLeftRight,
  Edit3,
  Trash2,
  Heart,
  Shield,
  Footprints,
  Eye,
  Lightbulb,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/layout/badge';
import { EquipmentReorderControls } from '@/components/ui/character/equipment/EquipmentReorderControls';
import { parseAcBonus } from '@/utils/calculations';
import type { CampaignNPC } from '@/types/encounter';
export interface NpcLibraryRowProps {
  npc: CampaignNPC;
  headingLevel: 3 | 4;
  moveLabel: string;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onDelete: () => void;
  viewRef?: (el: HTMLElement | null) => void;
  reorder?: {
    index: number;
    count: number;
    onMove: (destinationIndex: number) => void;
  };
}

export function NpcLibraryRow(props: NpcLibraryRowProps) {
  return (
    <>
      <NPCCard {...props} />
      {props.reorder && (
        <EquipmentReorderControls
          name={props.npc.name}
          index={props.reorder.index}
          count={props.reorder.count}
          onMove={props.reorder.onMove}
        />
      )}
    </>
  );
}
function NPCCard({
  npc,
  headingLevel,
  moveLabel,
  onEdit,
  onDuplicate,
  onMove,
  onDelete,
  onView,
  viewRef,
}: NpcLibraryRowProps) {
  const headingId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h4';
  const stats = npc.monsterStatBlock;
  const hasPortrait = !!npc.avatarUrl?.trim();

  return (
    <div className="border-accent-purple-border bg-surface-raised relative h-[210px] cursor-pointer overflow-hidden rounded-lg border-2 shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        ref={viewRef}
        aria-label="View"
        aria-describedby={headingId}
        onClick={onView}
        className="focus-visible:outline-ring absolute inset-0 z-10 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      {hasPortrait ? (
        /* Horizontal layout with tall portrait on the left */
        <div className="flex h-full">
          {/* Portrait column */}
          <div className="border-divider relative w-28 shrink-0 self-stretch border-r-2 sm:w-32">
            <Image
              src={npc.avatarUrl!.trim()}
              alt={npc.name}
              fill
              className="object-cover object-top"
            />
          </div>

          {/* Content column */}
          <div className="flex min-w-0 flex-1 flex-col p-3">
            {/* Header row */}
            <div className="mb-2 flex items-start justify-between gap-1">
              <div className="min-w-0">
                <Heading
                  id={headingId}
                  className="text-heading truncate text-sm leading-tight font-semibold"
                >
                  {npc.name}
                </Heading>
                {stats && (
                  <p className="text-muted truncate text-[10px]">
                    {stats.size} {stats.type}
                  </p>
                )}
              </div>
              <div className="relative z-20 flex shrink-0 items-center gap-0.5">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  className="text-muted hover:text-body rounded p-1 transition-colors"
                  aria-label={`Duplicate ${npc.name}`}
                >
                  <Copy size={13} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onMove();
                  }}
                  className="text-muted hover:text-accent-purple-text rounded p-1 transition-colors"
                  aria-label={moveLabel}
                >
                  <ArrowLeftRight size={13} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="text-muted hover:text-body rounded p-1 transition-colors"
                  aria-label={`Edit ${npc.name}`}
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
                  aria-label={`Delete ${npc.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <p
              className="text-muted mb-2 line-clamp-2 min-h-[28px] text-xs leading-snug"
              title={npc.description?.trim() || undefined}
            >
              {npc.description?.trim() || '\u00A0'}
            </p>

            {/* CR + Prof badges */}
            <div className="mb-2 flex flex-wrap gap-1">
              {stats?.cr != null && (
                <Badge
                  variant="outline"
                  size="sm"
                  className="rounded-full text-[10px]"
                >
                  CR {stats.cr}
                </Badge>
              )}
              {npc.proficiencyBonus != null && (
                <Badge
                  variant="neutral"
                  size="sm"
                  className="rounded-full text-[10px]"
                >
                  Prof +{npc.proficiencyBonus}
                </Badge>
              )}
              {npc.spellcasting && (
                <Badge
                  variant="info"
                  size="sm"
                  className="rounded-full text-[10px]"
                >
                  Caster Lv{npc.spellcasting.casterLevel}
                </Badge>
              )}
            </div>

            {/* HP / AC / Speed / PP */}
            <div className="text-body mb-1 flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-0.5">
                <Heart size={11} className="text-accent-red-text shrink-0" />
                {npc.maxHp}
              </span>
              {npc.hitDice && (
                <span className="text-muted text-[10px]">
                  HD {npc.hitDice.max}
                  {npc.hitDice.dieType}
                </span>
              )}
              <span className="flex items-center gap-0.5">
                <Shield size={11} className="text-accent-blue-text shrink-0" />
                {npc.armorClass}
                {parseAcBonus(npc.tempAc) !== 0
                  ? ` (+${parseAcBonus(npc.tempAc)})`
                  : ''}
              </span>
              <span className="flex items-center gap-0.5">
                <Footprints size={11} className="text-muted shrink-0" />
                {npc.speed}
              </span>
            </div>

            {/* Passive scores */}
            {(npc.passivePerception != null ||
              npc.passiveInsight != null ||
              npc.passiveInvestigation != null) && (
              <div className="bg-surface-secondary mb-1 flex items-center justify-between rounded-md px-2 py-1.5">
                {npc.passivePerception != null && (
                  <div
                    className="flex items-center gap-1"
                    title="Passive Perception"
                  >
                    <Eye size={11} className="text-accent-emerald-text" />
                    <span className="text-muted text-[9px] tracking-wide uppercase">
                      PP
                    </span>
                    <span className="text-heading text-xs font-bold">
                      {npc.passivePerception}
                    </span>
                  </div>
                )}
                {npc.passivePerception != null &&
                  npc.passiveInsight != null && (
                    <div className="bg-divider mx-1 h-3 w-px" />
                  )}
                {npc.passiveInsight != null && (
                  <div
                    className="flex items-center gap-1"
                    title="Passive Insight"
                  >
                    <Lightbulb size={11} className="text-accent-amber-text" />
                    <span className="text-muted text-[9px] tracking-wide uppercase">
                      PI
                    </span>
                    <span className="text-heading text-xs font-bold">
                      {npc.passiveInsight}
                    </span>
                  </div>
                )}
                {(npc.passivePerception != null ||
                  npc.passiveInsight != null) &&
                  npc.passiveInvestigation != null && (
                    <div className="bg-divider mx-1 h-3 w-px" />
                  )}
                {npc.passiveInvestigation != null && (
                  <div
                    className="flex items-center gap-1"
                    title="Passive Investigation"
                  >
                    <Search size={11} className="text-accent-blue-text" />
                    <span className="text-muted text-[9px] tracking-wide uppercase">
                      PIv
                    </span>
                    <span className="text-heading text-xs font-bold">
                      {npc.passiveInvestigation}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            <div className="mt-auto min-h-[18px]">
              {npc.tags && npc.tags.length > 0 && (
                <div
                  role="list"
                  aria-label="Tags"
                  className="flex flex-wrap gap-1"
                >
                  {[...new Set(npc.tags)].map(tag => (
                    <span
                      key={tag}
                      role="listitem"
                      className="bg-surface-secondary border-divider text-muted rounded-full border px-1.5 py-px text-[9px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Vertical layout (no portrait) */
        <div className="flex h-full flex-col p-4">
          {/* Header */}
          <div className="mb-2 flex items-start justify-between">
            <div className="min-w-0">
              <Heading
                id={headingId}
                className="text-heading truncate text-base font-semibold"
              >
                {npc.name}
              </Heading>
              {stats && (
                <p className="text-muted truncate text-xs">
                  {stats.size} {stats.type}
                </p>
              )}
            </div>
            <div className="relative z-20 flex shrink-0 items-center gap-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  onDuplicate();
                }}
                className="text-muted hover:text-body rounded p-1 transition-colors"
                aria-label={`Duplicate ${npc.name}`}
              >
                <Copy size={14} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onMove();
                }}
                className="text-muted hover:text-accent-purple-text rounded p-1 transition-colors"
                aria-label={moveLabel}
              >
                <ArrowLeftRight size={14} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="text-muted hover:text-body rounded p-1 transition-colors"
                aria-label={`Edit ${npc.name}`}
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-muted hover:text-accent-red-text rounded p-1 transition-colors"
                aria-label={`Delete ${npc.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <p
            className="text-muted mb-2 line-clamp-2 min-h-[34px] text-sm leading-snug"
            title={npc.description?.trim() || undefined}
          >
            {npc.description?.trim() || '\u00A0'}
          </p>

          {/* CR + Prof badges */}
          <div className="mb-2 flex flex-wrap gap-1">
            {stats?.cr != null && (
              <Badge
                variant="outline"
                size="sm"
                className="rounded-full text-[10px]"
              >
                CR {stats.cr}
              </Badge>
            )}
            {npc.proficiencyBonus != null && (
              <Badge
                variant="neutral"
                size="sm"
                className="rounded-full text-[10px]"
              >
                Prof +{npc.proficiencyBonus}
              </Badge>
            )}
            {npc.spellcasting && (
              <Badge
                variant="info"
                size="sm"
                className="rounded-full text-[10px]"
              >
                Caster Lv{npc.spellcasting.casterLevel}
              </Badge>
            )}
          </div>

          {/* HP / AC / Speed */}
          <div className="text-body flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1">
              <Heart size={12} className="text-accent-red-text" />
              {npc.maxHp} HP
            </span>
            {npc.hitDice && (
              <span className="text-muted text-xs">
                HD {npc.hitDice.max}
                {npc.hitDice.dieType}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Shield size={12} className="text-accent-blue-text" />
              AC {npc.armorClass}
              {parseAcBonus(npc.tempAc) !== 0
                ? ` (+${parseAcBonus(npc.tempAc)})`
                : ''}
            </span>
            <span className="flex items-center gap-1">
              <Footprints size={12} className="text-muted" />
              {npc.speed}
            </span>
          </div>

          {/* Passive scores */}
          {(npc.passivePerception != null ||
            npc.passiveInsight != null ||
            npc.passiveInvestigation != null) && (
            <div className="bg-surface-secondary mt-2 flex items-center justify-between rounded-lg px-3 py-2">
              {npc.passivePerception != null && (
                <div
                  className="flex items-center gap-1.5"
                  title="Passive Perception"
                >
                  <Eye size={13} className="text-accent-emerald-text" />
                  <span className="text-muted text-[10px] tracking-wide uppercase">
                    Perception
                  </span>
                  <span className="text-heading text-sm font-bold">
                    {npc.passivePerception}
                  </span>
                </div>
              )}
              {npc.passivePerception != null && npc.passiveInsight != null && (
                <div className="bg-divider h-4 w-px" />
              )}
              {npc.passiveInsight != null && (
                <div
                  className="flex items-center gap-1.5"
                  title="Passive Insight"
                >
                  <Lightbulb size={13} className="text-accent-amber-text" />
                  <span className="text-muted text-[10px] tracking-wide uppercase">
                    Insight
                  </span>
                  <span className="text-heading text-sm font-bold">
                    {npc.passiveInsight}
                  </span>
                </div>
              )}
              {(npc.passivePerception != null || npc.passiveInsight != null) &&
                npc.passiveInvestigation != null && (
                  <div className="bg-divider h-4 w-px" />
                )}
              {npc.passiveInvestigation != null && (
                <div
                  className="flex items-center gap-1.5"
                  title="Passive Investigation"
                >
                  <Search size={13} className="text-accent-blue-text" />
                  <span className="text-muted text-[10px] tracking-wide uppercase">
                    Investigation
                  </span>
                  <span className="text-heading text-sm font-bold">
                    {npc.passiveInvestigation}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Ability scores */}
          {npc.abilityScores && (
            <div className="mt-3 grid grid-cols-6 gap-1">
              {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map(
                ability => (
                  <div key={ability} className="text-center">
                    <span className="text-muted block text-[9px] font-medium uppercase">
                      {ability}
                    </span>
                    <span className="text-body text-xs font-medium">
                      {npc.abilityScores![ability]}
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {/* Tags */}
          <div className="mt-auto min-h-[18px]">
            {npc.tags && npc.tags.length > 0 && (
              <div
                role="list"
                aria-label="Tags"
                className="flex flex-wrap gap-1"
              >
                {[...new Set(npc.tags)].map(tag => (
                  <span
                    key={tag}
                    role="listitem"
                    className="bg-surface-secondary border-divider text-muted rounded-full border px-1.5 py-px text-[9px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
