'use client';

import React, {
  useState,
  ReactNode,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface BookmarkTabItem {
  id: string;
  label: string;
  icon?: string;
  content: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
  hidden?: boolean;
}

interface BookmarkTabsProps {
  tabs: BookmarkTabItem[];
  defaultTab?: string;
  persistKey?: string;
  className?: string;
  onTabChange?: (tabId: string) => void;
}

export interface BookmarkTabsRef {
  switchToTab: (tabId: string) => void;
  getCurrentTab: () => string;
}

const PERSIST_PREFIX = 'bookmark-tabs-';

const BookmarkTabs = forwardRef<BookmarkTabsRef, BookmarkTabsProps>(
  ({ tabs, defaultTab, persistKey, className = '', onTabChange }, ref) => {
    const visibleTabs = tabs.filter(t => !t.hidden);

    const getInitialTab = () => {
      if (persistKey) {
        try {
          const saved = localStorage.getItem(`${PERSIST_PREFIX}${persistKey}`);
          if (saved && visibleTabs.find(t => t.id === saved && !t.disabled)) {
            return saved;
          }
        } catch {}
      }
      return defaultTab || visibleTabs[0]?.id;
    };

    const [activeTab, setActiveTab] = useState(getInitialTab);
    const [isMounted, setIsMounted] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    useEffect(() => {
      setIsMounted(true);
    }, []);

    const checkScrollability = useCallback(() => {
      const nav = navRef.current;
      if (!nav) return;
      setCanScrollLeft(nav.scrollLeft > 2);
      setCanScrollRight(nav.scrollLeft < nav.scrollWidth - nav.clientWidth - 2);
    }, []);

    useEffect(() => {
      const nav = navRef.current;
      if (!nav) return;
      checkScrollability();
      nav.addEventListener('scroll', checkScrollability, { passive: true });
      const observer = new ResizeObserver(checkScrollability);
      observer.observe(nav);
      return () => {
        nav.removeEventListener('scroll', checkScrollability);
        observer.disconnect();
      };
    }, [checkScrollability]);

    const handleTabChange = useCallback(
      (tabId: string) => {
        setActiveTab(tabId);
        onTabChange?.(tabId);
        if (persistKey) {
          try {
            localStorage.setItem(`${PERSIST_PREFIX}${persistKey}`, tabId);
          } catch {}
        }
      },
      [onTabChange, persistKey]
    );

    useImperativeHandle(
      ref,
      () => ({
        switchToTab: (tabId: string) => {
          const tab = visibleTabs.find(t => t.id === tabId && !t.disabled);
          if (tab) {
            handleTabChange(tabId);
            setTimeout(() => {
              const el = document.getElementById('bookmark-tabs-root');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        },
        getCurrentTab: () => activeTab,
      }),
      [activeTab, visibleTabs, handleTabChange]
    );

    const scrollNav = (direction: 'left' | 'right') => {
      const nav = navRef.current;
      if (!nav) return;
      const amount = nav.clientWidth * 0.6;
      nav.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth',
      });
    };

    const activeTabContent = isMounted
      ? visibleTabs.find(t => t.id === activeTab)?.content
      : null;

    return (
      <div id="bookmark-tabs-root" className={`w-full ${className}`}>
        {/* Tab Navigation */}
        <div className="relative flex items-end">
          {/* Left scroll indicator */}
          {canScrollLeft && (
            <button
              onClick={() => scrollNav('left')}
              className="bg-surface-raised/90 text-muted hover:text-body absolute top-0 bottom-0 left-0 z-10 flex w-8 items-center justify-center backdrop-blur-sm"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <nav
            ref={navRef}
            className="scrollbar-hide flex items-end gap-0.5 overflow-x-auto px-1 pt-2"
            role="tablist"
          >
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  onClick={() => !tab.disabled && handleTabChange(tab.id)}
                  disabled={tab.disabled}
                  className={`relative flex min-w-0 shrink-0 items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'bg-surface-raised text-heading z-10 -mb-px border-t-2 border-r border-l border-t-blue-500 border-r-[var(--color-border-divider)] border-l-[var(--color-border-divider)] shadow-sm'
                      : tab.disabled
                        ? 'text-faint cursor-not-allowed opacity-50'
                        : 'bg-surface-secondary text-muted hover:bg-surface-hover hover:text-body border border-transparent'
                  } focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none`}
                >
                  {tab.icon && (
                    <span className="text-base" role="img" aria-hidden="true">
                      {tab.icon}
                    </span>
                  )}
                  <span>{tab.label}</span>
                  {tab.badge && <span className="ml-1">{tab.badge}</span>}
                </button>
              );
            })}
          </nav>

          {/* Right scroll indicator */}
          {canScrollRight && (
            <button
              onClick={() => scrollNav('right')}
              className="bg-surface-raised/90 text-muted hover:text-body absolute top-0 right-0 bottom-0 z-10 flex w-8 items-center justify-center backdrop-blur-sm"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={activeTab}
          className="border-divider bg-surface-raised rounded-tr-lg rounded-b-lg border shadow-lg"
        >
          <div className="p-4 sm:p-6">
            {!isMounted ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted">Loading...</div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-200">
                {activeTabContent}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

BookmarkTabs.displayName = 'BookmarkTabs';

export default BookmarkTabs;
