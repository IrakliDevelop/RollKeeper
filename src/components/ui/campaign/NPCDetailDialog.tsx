'use client';

import React, { useState } from 'react';
import {
  Edit3,
  Trash2,
  Heart,
  Shield,
  Footprints,
  BookOpen,
  ScrollText,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { MonsterStatBlockPanel } from '@/components/ui/encounter/MonsterStatBlockPanel';
import type { CampaignNPC } from '@/types/encounter';

type DetailTab = 'stats' | 'lore';

interface NPCDetailDialogProps {
  npc: CampaignNPC | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (npc: CampaignNPC) => void;
  onDelete: (npc: CampaignNPC) => void;
}

const ABILITY_LABELS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

function AbilityScoreGrid({
  scores,
}: {
  scores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
}) {
  return (
    <div className="grid grid-cols-6 gap-2 text-center">
      {ABILITY_KEYS.map((key, i) => {
        const mod = Math.floor((scores[key] - 10) / 2);
        const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
        return (
          <div
            key={key}
            className="bg-surface-secondary rounded-lg px-2 py-1.5"
          >
            <span className="text-muted block text-[10px] font-bold tracking-wide uppercase">
              {ABILITY_LABELS[i]}
            </span>
            <span className="text-heading block text-sm font-semibold">
              {scores[key]}
            </span>
            <span className="text-muted block text-xs">({modStr})</span>
          </div>
        );
      })}
    </div>
  );
}

export function NPCDetailDialog({
  npc,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: NPCDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('stats');
  const [showFullImage, setShowFullImage] = useState(false);

  if (!npc) return null;

  const statBlock = npc.monsterStatBlock;
  const typeInfo = statBlock
    ? `${statBlock.size} ${statBlock.type}${statBlock.cr ? ` — CR ${statBlock.cr}` : ''}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-4 pr-16">
            {npc.avatarUrl && (
              <button
                type="button"
                onClick={() => setShowFullImage(true)}
                className="group relative shrink-0"
                title="Click to view full image"
              >
                <img
                  src={npc.avatarUrl}
                  alt={npc.name}
                  className="border-divider h-14 w-14 rounded-full border-2 object-cover transition-opacity group-hover:opacity-80"
                />
                <span className="bg-surface/80 absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100">
                  <svg
                    className="text-heading h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                    />
                  </svg>
                </span>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-heading text-xl font-bold">
                {npc.name}
              </DialogTitle>
              {npc.description && (
                <p className="text-muted mt-0.5 text-sm">{npc.description}</p>
              )}
              {typeInfo && (
                <p className="text-faint mt-0.5 text-xs italic">{typeInfo}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onEdit(npc);
                  onOpenChange(false);
                }}
                aria-label="Edit NPC"
              >
                <Edit3 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(npc)}
                aria-label="Delete NPC"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Tab bar */}
        <div className="bg-surface-secondary flex rounded-lg p-1">
          <button
            type="button"
            onClick={() => setActiveTab('stats')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'stats'
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            <ScrollText className="h-3.5 w-3.5" />
            Stat Block
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lore')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'lore'
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Lore
          </button>
        </div>

        <DialogBody>
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {statBlock ? (
                <MonsterStatBlockPanel statBlock={statBlock} />
              ) : (
                <>
                  {/* Basic stats row */}
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2">
                      <Heart className="text-accent-red-text h-4 w-4" />
                      <span className="text-muted text-xs">HP</span>
                      <span className="text-heading text-sm font-semibold">
                        {npc.maxHp}
                      </span>
                    </div>
                    <div className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2">
                      <Shield className="text-accent-blue-text h-4 w-4" />
                      <span className="text-muted text-xs">AC</span>
                      <span className="text-heading text-sm font-semibold">
                        {npc.armorClass}
                      </span>
                    </div>
                    <div className="bg-surface-secondary flex items-center gap-2 rounded-lg px-3 py-2">
                      <Footprints className="text-accent-amber-text h-4 w-4" />
                      <span className="text-muted text-xs">Speed</span>
                      <span className="text-heading text-sm font-semibold">
                        {npc.speed}
                      </span>
                    </div>
                  </div>

                  {npc.abilityScores && (
                    <AbilityScoreGrid scores={npc.abilityScores} />
                  )}

                  {npc.description && !npc.abilityScores && (
                    <p className="text-body text-sm">{npc.description}</p>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'lore' && (
            <div>
              {npc.loreHtml ? (
                <div
                  className="prose prose-sm text-body max-w-none"
                  dangerouslySetInnerHTML={{ __html: npc.loreHtml }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="text-faint mb-3 h-10 w-10" />
                  <p className="text-muted text-sm">No lore written yet</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      onEdit(npc);
                      onOpenChange(false);
                    }}
                  >
                    Edit to add lore
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              onEdit(npc);
              onOpenChange(false);
            }}
          >
            <Edit3 className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button variant="danger" onClick={() => onDelete(npc)}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>

      {showFullImage && npc.avatarUrl && (
        <div
          className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowFullImage(false)}
        >
          <button
            type="button"
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            aria-label="Close image"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={npc.avatarUrl}
            alt={npc.name}
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-center text-sm text-white/60">
            Right-click image to copy or save
          </p>
        </div>
      )}
    </Dialog>
  );
}
