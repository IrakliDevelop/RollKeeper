'use client';

import React, { useState } from 'react';
import { User, Heart, Star, Link, AlertTriangle } from 'lucide-react';
import { CharacterBackground } from '@/types/character';
import { RichTextEditor } from '@/components/ui/forms';

interface CharacterBackgroundEditorProps {
  background: CharacterBackground;
  onChange: (updates: Partial<CharacterBackground>) => void;
  className?: string;
}

type BackgroundTab = 'backstory' | 'personality' | 'ideals' | 'bonds' | 'flaws';

interface TabConfig {
  id: BackgroundTab;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  description: string;
  color: string;
}

const BACKGROUND_TABS: TabConfig[] = [
  {
    id: 'backstory',
    label: 'Backstory',
    icon: <User size={16} />,
    placeholder: 'Tell your character\'s story...',
    description: 'Your character\'s history, origins, and important life events.',
    color: 'blue'
  },
  {
    id: 'personality',
    label: 'Personality',
    icon: <Star size={16} />,
    placeholder: 'Describe your character\'s personality...',
    description: 'Personality traits, mannerisms, and behavioral quirks.',
    color: 'purple'
  },
  {
    id: 'ideals',
    label: 'Ideals',
    icon: <Heart size={16} />,
    placeholder: 'What drives your character...',
    description: 'Principles, values, and beliefs that motivate your character.',
    color: 'rose'
  },
  {
    id: 'bonds',
    label: 'Bonds',
    icon: <Link size={16} />,
    placeholder: 'Who or what matters to your character...',
    description: 'Important people, places, or things your character cares about.',
    color: 'green'
  },
  {
    id: 'flaws',
    label: 'Flaws',
    icon: <AlertTriangle size={16} />,
    placeholder: 'Your character\'s weaknesses...',
    description: 'Weaknesses, fears, or negative traits that create interesting roleplay.',
    color: 'orange'
  }
];

export default function CharacterBackgroundEditor({
  background,
  onChange,
  className = ''
}: CharacterBackgroundEditorProps) {
  const [activeTab, setActiveTab] = useState<BackgroundTab>('backstory');

  const activeTabConfig = BACKGROUND_TABS.find(tab => tab.id === activeTab)!;

  const handleContentChange = (field: BackgroundTab, content: string) => {
    onChange({ [field]: content });
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg border border-gray-200 ${className}`}>
      <div className="border-b border-gray-200">
        <div className="p-4">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Character Background
          </h2>
          
          {/* Tab Navigation */}
          <div className="flex flex-wrap gap-2">
            {BACKGROUND_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? `bg-${tab.color}-100 text-${tab.color}-700 border border-${tab.color}-300`
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center space-x-2 mb-2">
            <div className={`text-${activeTabConfig.color}-600`}>
              {activeTabConfig.icon}
            </div>
            <h3 className={`font-semibold text-${activeTabConfig.color}-800`}>
              {activeTabConfig.label}
            </h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {activeTabConfig.description}
          </p>
        </div>

        <RichTextEditor
          key={activeTab} // Force re-render when tab changes
          content={background[activeTab]}
          onChange={(content) => handleContentChange(activeTab, content)}
          placeholder={activeTabConfig.placeholder}
          minHeight="200px"
        />

        {/* Character Count & Tips */}
        <div className="mt-4 flex items-start justify-between">
          <div className="text-xs text-gray-500">
            {background[activeTab] && (
              <span>
                {background[activeTab].replace(/<[^>]*>/g, '').length} characters
              </span>
            )}
          </div>
          
          <div className="text-xs text-gray-500 max-w-sm">
            <details className="cursor-pointer">
              <summary className="font-medium hover:text-gray-700">
                💡 Tips for {activeTabConfig.label}
              </summary>
              <div className="mt-2 space-y-1">
                {activeTab === 'backstory' && (
                  <>
                    <p>• Include your character&apos;s origins and family</p>
                    <p>• Mention key events that shaped them</p>
                    <p>• Explain how they got their class abilities</p>
                  </>
                )}
                {activeTab === 'personality' && (
                  <>
                    <p>• Describe how they interact with others</p>
                    <p>• Include speech patterns or mannerisms</p>
                    <p>• Mention what makes them laugh or angry</p>
                  </>
                )}
                {activeTab === 'ideals' && (
                  <>
                    <p>• What principles guide their decisions?</p>
                    <p>• What do they believe is most important?</p>
                    <p>• What would they die for?</p>
                  </>
                )}
                {activeTab === 'bonds' && (
                  <>
                    <p>• Important people in their life</p>
                    <p>• Meaningful possessions or locations</p>
                    <p>• Goals or promises they&apos;ve made</p>
                  </>
                )}
                {activeTab === 'flaws' && (
                  <>
                    <p>• Fears or phobias they struggle with</p>
                    <p>• Bad habits or vices</p>
                    <p>• Ways they might betray the party</p>
                  </>
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
} 