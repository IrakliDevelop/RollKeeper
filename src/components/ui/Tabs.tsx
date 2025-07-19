'use client';

import React, { useState, ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTab?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
}

export default function Tabs({ tabs, defaultTab, className = '', onTabChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const activeTabContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={`w-full ${className}`}>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-t-lg shadow-sm">
        <nav className="flex space-x-0 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && handleTabChange(tab.id)}
              disabled={tab.disabled}
              className={`
                relative min-w-0 flex-1 whitespace-nowrap py-4 px-6 text-sm font-medium text-center border-b-2 transition-all duration-200 ease-in-out
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : tab.disabled
                  ? 'border-transparent text-gray-400 cursor-not-allowed'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }
                ${!tab.disabled && 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}
              `}
            >
              <div className="flex items-center justify-center gap-2">
                {tab.icon && (
                  <span className="text-lg" role="img" aria-label={tab.label}>
                    {tab.icon}
                  </span>
                )}
                <span className="font-semibold">{tab.label}</span>
              </div>
              
              {/* Active indicator */}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-sm transition-all duration-200" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-b-lg shadow-lg border border-gray-200 border-t-0">
        <div className="min-h-[400px] max-h-[80vh] overflow-y-auto">
          <div className="p-6">
            {activeTabContent}
          </div>
        </div>
      </div>
    </div>
  );
}

// Utility component for tab content with consistent styling
export function TabContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {children}
    </div>
  );
} 