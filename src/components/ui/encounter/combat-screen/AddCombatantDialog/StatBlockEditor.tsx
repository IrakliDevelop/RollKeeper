'use client';

import React, { useId, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { SubTabs, type SubTabDefinition } from '@/components/ui/layout/SubTabs';
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
  resetLabel?: string;
}

type EditorTab = 'stats' | 'actions';

const ENTRY_SECTIONS: Array<{
  key: 'traits' | 'actions' | 'bonusActions' | 'reactions';
  title: string;
}> = [
  { key: 'traits', title: 'Traits' },
  { key: 'actions', title: 'Actions' },
  { key: 'bonusActions', title: 'Bonus actions' },
  { key: 'reactions', title: 'Reactions' },
];

export function StatBlockEditor({
  monsterName,
  draft,
  onDraftChange,
  onReset,
  onBack,
  resetLabel = 'Reset to original',
}: StatBlockEditorProps) {
  const [tab, setTab] = useState<EditorTab>('stats');
  const tabId = useId();

  const patchBlock = (patch: Partial<MonsterStatBlock>) =>
    onDraftChange(updateDraftStatBlock(draft, patch));

  const tabs: SubTabDefinition[] = [
    {
      value: 'stats',
      id: `${tabId}-stats`,
      label: 'Stats',
      content: (
        <StatBlockEditorStats draft={draft} onDraftChange={onDraftChange} />
      ),
    },
    {
      value: 'actions',
      id: `${tabId}-actions`,
      label: 'Actions and traits',
      content: (
        <div className="space-y-4">
          {ENTRY_SECTIONS.map(section => (
            <StatBlockEntriesEditor
              key={section.key}
              title={section.title}
              entries={draft.statBlock[section.key] ?? []}
              onChange={entries => patchBlock({ [section.key]: entries })}
            />
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          leftIcon={<ArrowLeft size={16} />}
        >
          Back to {monsterName}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          leftIcon={<RotateCcw size={16} />}
        >
          {resetLabel}
        </Button>
      </div>
      <SubTabs
        tabs={tabs}
        label="Stat block sections"
        value={tab}
        onValueChange={value => {
          if (value === 'stats' || value === 'actions') setTab(value);
        }}
      />
    </div>
  );
}
