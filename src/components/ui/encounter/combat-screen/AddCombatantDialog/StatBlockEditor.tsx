'use client';

import React, { useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { StatBlockEntriesEditor } from '../StatBlockEntriesEditor';
import { StatBlockEditorStats } from './StatBlockEditorStats';
import { updateDraftStatBlock } from './monsterEditDraft';
import type { MonsterEditDraft } from './monsterEditDraft';
import type { MonsterStatBlock } from '@/types/encounter';

interface StatBlockEditorProps {
  monsterName: string;
  draft: MonsterEditDraft;
  onDraftChange: (draft: MonsterEditDraft) => void;
  onReset: () => void;
  onBack: () => void;
}

type EditorTab = 'stats' | 'actions';

const ENTRY_SECTIONS: Array<{
  key: 'traits' | 'actions' | 'bonusActions' | 'reactions';
  title: string;
}> = [
  { key: 'traits', title: 'Traits' },
  { key: 'actions', title: 'Actions' },
  { key: 'bonusActions', title: 'Bonus Actions' },
  { key: 'reactions', title: 'Reactions' },
];

export function StatBlockEditor({
  monsterName,
  draft,
  onDraftChange,
  onReset,
  onBack,
}: StatBlockEditorProps) {
  const [tab, setTab] = useState<EditorTab>('stats');

  const patchBlock = (patch: Partial<MonsterStatBlock>) =>
    onDraftChange(updateDraftStatBlock(draft, patch));

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-muted hover:text-heading flex items-center gap-1 text-[13.5px] font-bold transition-colors"
        >
          <ArrowLeft size={14} /> Back to {monsterName}
        </button>
        <button
          onClick={onReset}
          className="text-muted hover:text-heading flex items-center gap-1 text-[12px] font-bold transition-colors"
        >
          <RotateCcw size={12} /> Reset to original
        </button>
      </div>

      {/* Sub-tab bar (mirrors the dialog's main tab bar styling) */}
      <div className="bg-surface-inset flex gap-[3px] rounded-[12px] p-1">
        {(
          [
            { id: 'stats', label: 'Stats' },
            { id: 'actions', label: 'Actions & Traits' },
          ] as Array<{ id: EditorTab; label: string }>
        ).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-[9px] px-1.5 py-[7px] text-[13px] font-bold transition-all ${
              tab === t.id
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <StatBlockEditorStats draft={draft} onDraftChange={onDraftChange} />
      )}

      {tab === 'actions' && (
        <div className="space-y-4">
          {ENTRY_SECTIONS.map(section => (
            <StatBlockEntriesEditor
              key={section.key}
              title={section.title}
              entries={draft.statBlock[section.key]}
              onChange={entries => patchBlock({ [section.key]: entries })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
