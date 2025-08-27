'use client';

import React, { useState, ReactNode, useEffect, forwardRef, useImperativeHandle } from 'react';

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

export interface TabsRef {
  switchToTab: (tabId: string) => void;
  getCurrentTab: () => string;
}

const Tabs = forwardRef<TabsRef, TabsProps>(({ tabs, defaultTab, className = '', onTabChange }, ref) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure we're mounted on the client to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []); // Only run once on mount

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  // Expose tab switching functionality via ref
  useImperativeHandle(ref, () => ({
    switchToTab: (tabId: string) => {
      if (tabs.find(tab => tab.id === tabId && !tab.disabled)) {
        handleTabChange(tabId);
        // Scroll to tabs after switching
        setTimeout(() => {
          const tabsElement = document.getElementById('character-tabs');
          if (tabsElement) {
            tabsElement.scrollIntoView({ 
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 100);
      }
    },
    getCurrentTab: () => activeTab
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [activeTab, tabs]);

  // Don't render tab content until mounted to prevent hydration mismatch
  const activeTabContent = isMounted ? tabs.find(tab => tab.id === activeTab)?.content : null;

  return (
    <div id="character-tabs" className={`w-full ${className}`}>
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
            {/* Show loading state until mounted, then show content */}
            {!isMounted ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : (
              activeTabContent
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

Tabs.displayName = 'Tabs';

export default Tabs;

// Utility component for tab content with consistent styling
export function TabContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {children}
    </div>
  );
} 