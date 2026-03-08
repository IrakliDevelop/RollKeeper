'use client';

import React, {
  useState,
  ReactNode,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
  useCallback,
  useMemo,
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
    const rootRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const visibleTabs = useMemo(() => tabs.filter(t => !t.hidden), [tabs]);
    const visibleTabIds = useMemo(
      () => visibleTabs.map(t => t.id).join(','),
      [visibleTabs]
    );

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

    useEffect(() => {
      setIsMounted(true);
    }, []);

    useEffect(() => {
      const stillValid = visibleTabs.some(
        t => t.id === activeTab && !t.disabled
      );
      if (!stillValid) {
        const fallback =
          defaultTab &&
          visibleTabs.find(t => t.id === defaultTab && !t.disabled)
            ? defaultTab
            : visibleTabs[0]?.id;
        if (fallback) setActiveTab(fallback);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleTabIds]);

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
              rootRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
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

    const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
      () => new Set([activeTab])
    );

    useEffect(() => {
      setVisitedTabs(prev => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    }, [activeTab]);

    const tabButtonId = (tabId: string) => `tab-${tabId}`;
    const tabPanelId = (tabId: string) => `tabpanel-${tabId}`;

    return (
      <div ref={rootRef} className={`w-full ${className}`}>
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
                  id={tabButtonId(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={
                    visitedTabs.has(tab.id) ? tabPanelId(tab.id) : undefined
                  }
                  tabIndex={isActive ? 0 : -1}
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

        {/* Tab Panels — visited tabs stay mounted but hidden */}
        <div className="border-divider bg-surface-raised rounded-tr-lg rounded-b-lg border shadow-lg">
          <div className="p-4 sm:p-6">
            {!isMounted ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted">Loading...</div>
              </div>
            ) : (
              visibleTabs.map(tab => {
                const isActive = activeTab === tab.id;
                if (!visitedTabs.has(tab.id)) return null;
                return (
                  <div
                    key={tab.id}
                    role="tabpanel"
                    id={tabPanelId(tab.id)}
                    aria-labelledby={tabButtonId(tab.id)}
                    hidden={!isActive}
                  >
                    {tab.content}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }
);

BookmarkTabs.displayName = 'BookmarkTabs';

export default BookmarkTabs;
