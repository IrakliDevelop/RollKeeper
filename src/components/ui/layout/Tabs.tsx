'use client';

import React, {
  useState,
  ReactNode,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';

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

const Tabs = forwardRef<TabsRef, TabsProps>(
  ({ tabs, defaultTab, className = '', onTabChange }, ref) => {
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
    useImperativeHandle(
      ref,
      () => ({
        switchToTab: (tabId: string) => {
          if (tabs.find(tab => tab.id === tabId && !tab.disabled)) {
            handleTabChange(tabId);
            // Scroll to tabs after switching
            setTimeout(() => {
              const tabsElement = document.getElementById('character-tabs');
              if (tabsElement) {
                tabsElement.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }
            }, 100);
          }
        },
        getCurrentTab: () => activeTab,
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [activeTab, tabs]
    );

    // Don't render tab content until mounted to prevent hydration mismatch
    const activeTabContent = isMounted
      ? tabs.find(tab => tab.id === activeTab)?.content
      : null;

    return (
      <div id="character-tabs" className={`w-full ${className}`}>
        {/* Tab Navigation */}
        <div className="rounded-t-lg border-b border-gray-200 bg-white shadow-sm">
          <nav className="scrollbar-hide flex space-x-0 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => !tab.disabled && handleTabChange(tab.id)}
                disabled={tab.disabled}
                className={`relative min-w-0 flex-1 border-b-2 px-6 py-4 text-center text-sm font-medium whitespace-nowrap transition-all duration-200 ease-in-out ${
                  activeTab === tab.id
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : tab.disabled
                      ? 'cursor-not-allowed border-transparent text-gray-400'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                } ${!tab.disabled && 'focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none'} `}
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
                  <div className="absolute right-0 bottom-0 left-0 h-0.5 rounded-t-sm bg-blue-500 transition-all duration-200" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="rounded-b-lg border border-t-0 border-gray-200 bg-white shadow-lg">
          <div className="max-h-[80vh] min-h-[400px] overflow-y-auto">
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
  }
);

Tabs.displayName = 'Tabs';

export default Tabs;

// Utility component for tab content with consistent styling
export function TabContent({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`space-y-6 ${className}`}>{children}</div>;
}
