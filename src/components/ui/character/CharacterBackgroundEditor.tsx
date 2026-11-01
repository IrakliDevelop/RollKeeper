'use client';

import { useState } from 'react';
import type { CharacterBackground } from '@/types/character';
import { RichTextEditor } from '@/components/ui/forms';
import { Section } from '@/components/ui/layout/section';
import { SubTabs } from '@/components/ui/layout/SubTabs';

type BackgroundTab = 'backstory' | 'personality' | 'ideals' | 'bonds' | 'flaws';

interface CharacterBackgroundEditorProps {
  background: CharacterBackground;
  onChange: (updates: Partial<CharacterBackground>) => void;
  className?: string;
}

const BACKGROUND_TABS: {
  id: BackgroundTab;
  label: string;
  placeholder: string;
  description: string;
  tips: string[];
}[] = [
  {
    id: 'backstory',
    label: 'Backstory',
    placeholder: "Tell your character's story",
    description:
      "Your character's history, origins, and important life events.",
    tips: [
      "Include your character's origins and family",
      'Mention key events that shaped them',
      'Explain how they got their class abilities',
    ],
  },
  {
    id: 'personality',
    label: 'Personality',
    placeholder: "Describe your character's personality",
    description: 'Personality traits, mannerisms, and behavioral quirks.',
    tips: [
      'Describe how they interact with others',
      'Include speech patterns or mannerisms',
      'Mention what makes them laugh or angry',
    ],
  },
  {
    id: 'ideals',
    label: 'Ideals',
    placeholder: 'What drives your character',
    description:
      'Principles, values, and beliefs that motivate your character.',
    tips: [
      'What principles guide their decisions?',
      'What do they believe is most important?',
      'What would they die for?',
    ],
  },
  {
    id: 'bonds',
    label: 'Bonds',
    placeholder: 'Who or what matters to your character',
    description:
      'Important people, places, or things your character cares about.',
    tips: [
      'Important people in their life',
      'Meaningful possessions or locations',
      "Goals or promises they've made",
    ],
  },
  {
    id: 'flaws',
    label: 'Flaws',
    placeholder: "Your character's weaknesses",
    description:
      'Weaknesses, fears, or negative traits that create interesting roleplay.',
    tips: [
      'Fears or phobias they struggle with',
      'Bad habits or vices',
      'Ways they might betray the party',
    ],
  },
];

export default function CharacterBackgroundEditor({
  background,
  onChange,
  className,
}: CharacterBackgroundEditorProps) {
  const [activeTab, setActiveTab] = useState<BackgroundTab>('backstory');

  return (
    <Section heading="Character background" className={className}>
      <SubTabs
        label="Character background"
        value={activeTab}
        onValueChange={value => setActiveTab(value as BackgroundTab)}
        tabs={BACKGROUND_TABS.map(tab => ({
          value: tab.id,
          id: `background-${tab.id}`,
          label: tab.label,
          content: (
            <div className="space-y-4">
              <p className="type-body text-muted">{tab.description}</p>
              <RichTextEditor
                key={tab.id}
                content={background[tab.id]}
                onChange={content => onChange({ [tab.id]: content })}
                placeholder={tab.placeholder}
                minHeight="200px"
              />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="type-caption text-muted">
                  {background[tab.id] && (
                    <>
                      {background[tab.id].replace(/<[^>]*>/g, '').length}{' '}
                      characters
                    </>
                  )}
                </p>
                <details className="type-caption text-muted max-w-sm">
                  <summary className="hover:text-body cursor-pointer py-2 pointer-coarse:min-h-11">
                    {tab.label} tips
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {tab.tips.map(tip => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          ),
        }))}
      />
    </Section>
  );
}
