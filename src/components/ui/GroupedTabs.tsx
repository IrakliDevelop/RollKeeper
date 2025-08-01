'use client';

import React, { useState, ReactNode, useEffect, forwardRef, useImperativeHandle } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabGroup {
  id: string;
  label: string;
  icon?: string;
  tabs: TabItem[];
  defaultOpen?: boolean;
}

interface GroupedTabsProps {
  groups: TabGroup[];
  defaultTab?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
}

export interface GroupedTabsRef {
  switchToTab: (tabId: string) => void;
  getCurrentTab: () => string;
}

const GroupedTabs = forwardRef<GroupedTabsRef, GroupedTabsProps>(({ 
  groups, 
  defaultTab, 
  className = '', 
  onTabChange 
}, ref) => {
  // Find the first available tab if no default is specified
  const firstAvailableTab = defaultTab || groups[0]?.tabs[0]?.id;
  
  const [activeTab, setActiveTab] = useState(firstAvailableTab);
  const [isMounted, setIsMounted] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Initially open the group containing the active tab, plus any marked as defaultOpen
    const initialOpen = new Set<string>();
    
    groups.forEach(group => {
      if (group.defaultOpen || group.tabs.some(tab => tab.id === firstAvailableTab)) {
        initialOpen.add(group.id);
      }
    });
    
    return initialOpen;
  });

  // Ensure we're mounted on the client to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []); // Only run once on mount

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onTabChange?.(tabId);
    
    // Auto-open the group containing this tab
    groups.forEach(group => {
      if (group.tabs.some(tab => tab.id === tabId)) {
        setOpenGroups(prev => new Set([...prev, group.id]));
      }
    });
  };

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Expose tab switching functionality via ref
  useImperativeHandle(ref, () => ({
    switchToTab: (tabId: string) => {
      const targetTab = groups.flatMap(g => g.tabs).find(tab => tab.id === tabId && !tab.disabled);
      if (targetTab) {
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
  [activeTab, groups]);

  // Find the active tab content
  const activeTabContent = isMounted 
    ? groups.flatMap(g => g.tabs).find(tab => tab.id === activeTab)?.content 
    : null;

  return (
    <div id="character-tabs" className={`w-full ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 sticky top-6">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sections</h3>
            </div>
            
            <nav className="p-2">
              {groups.map((group) => (
                <div key={group.id} className="mb-2">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {group.icon && (
                        <span className="text-lg" role="img" aria-label={group.label}>
                          {group.icon}
                        </span>
                      )}
                      <span className="font-semibold">{group.label}</span>
                    </div>
                    {openGroups.has(group.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  
                  {/* Group Tabs */}
                  {openGroups.has(group.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {group.tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => !tab.disabled && handleTabChange(tab.id)}
                          disabled={tab.disabled}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-all duration-200
                            ${activeTab === tab.id
                              ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-500 font-medium'
                              : tab.disabled
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }
                          `}
                        >
                          {tab.icon && (
                            <span className="text-base" role="img" aria-label={tab.label}>
                              {tab.icon}
                            </span>
                          )}
                          <span>{tab.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200">
            {/* Content Header */}
            <div className="p-6 border-b border-gray-200">
              {(() => {
                const currentTab = groups.flatMap(g => g.tabs).find(tab => tab.id === activeTab);
                const currentGroup = groups.find(g => g.tabs.some(tab => tab.id === activeTab));
                
                return (
                  <div className="flex items-center gap-3">
                    {currentGroup?.icon && (
                      <span className="text-2xl" role="img" aria-label={currentGroup.label}>
                        {currentGroup.icon}
                      </span>
                    )}
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {currentTab?.label}
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        {currentGroup?.label}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px] max-h-[80vh] overflow-y-auto">
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
      </div>
    </div>
  );
});

GroupedTabs.displayName = 'GroupedTabs';

export default GroupedTabs;

// Utility component for tab content with consistent styling
export function TabContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {children}
    </div>
  );
} 