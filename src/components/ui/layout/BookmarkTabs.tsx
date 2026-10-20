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
import { cn } from '@/utils/cn';

export interface BookmarkTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
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

const SCROLL_BUTTON =
  'bg-surface text-muted hover:text-body absolute top-0 bottom-px z-10 flex w-8 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring pointer-coarse:w-11';

const BookmarkTabs = forwardRef<BookmarkTabsRef, BookmarkTabsProps>(
  ({ tabs, defaultTab, persistKey, className = '', onTabChange }, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const navRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef(new Map<string, HTMLButtonElement>());
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

    // Arrow keys, Home and End move to the next enabled tab and open it,
    // wrapping at the ends (automatic activation, like the VTT tab bars).
    const handleTabListKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
      // Alt/Ctrl/Meta + arrows belong to the browser (history, text).
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const enabled = visibleTabs.filter(t => !t.disabled);
      const index = enabled.findIndex(t => t.id === activeTab);
      if (index < 0) return;
      let next: BookmarkTabItem;
      switch (event.key) {
        case 'ArrowRight':
          next = enabled[(index + 1) % enabled.length];
          break;
        case 'ArrowLeft':
          next = enabled[(index - 1 + enabled.length) % enabled.length];
          break;
        case 'Home':
          next = enabled[0];
          break;
        case 'End':
          next = enabled[enabled.length - 1];
          break;
        default:
          return;
      }
      event.preventDefault();
      handleTabChange(next.id);
      const button = tabRefs.current.get(next.id);
      button?.focus();
      button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

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
        <div className="relative">
          {/* Left scroll indicator */}
          {canScrollLeft && (
            <button
              onClick={() => scrollNav('left')}
              className={cn(SCROLL_BUTTON, 'left-0')}
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          <nav
            ref={navRef}
            // scroll-px keeps a tab scrolled into view clear of the chevrons.
            className="scrollbar-hide border-divider flex scroll-px-8 gap-1 overflow-x-auto overflow-y-hidden border-b pointer-coarse:scroll-px-11"
            role="tablist"
            onKeyDown={handleTabListKeyDown}
          >
            {visibleTabs.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={node => {
                    if (node) tabRefs.current.set(tab.id, node);
                    else tabRefs.current.delete(tab.id);
                  }}
                  id={tabButtonId(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={
                    visitedTabs.has(tab.id) ? tabPanelId(tab.id) : undefined
                  }
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => !tab.disabled && handleTabChange(tab.id)}
                  disabled={tab.disabled}
                  className={cn(
                    'relative flex min-w-0 shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-120 ease-out',
                    'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2 pointer-coarse:min-h-11',
                    isActive
                      ? 'border-brass-fill text-heading'
                      : tab.disabled
                        ? 'text-faint cursor-not-allowed border-transparent opacity-50'
                        : 'text-muted hover:text-body border-transparent'
                  )}
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
              className={cn(SCROLL_BUTTON, 'right-0')}
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Tab Panels — visited tabs stay mounted but hidden. They sit on
            the page canvas, with no box of their own. */}
        <div className="py-4 sm:py-6">
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
    );
  }
);

BookmarkTabs.displayName = 'BookmarkTabs';

export default BookmarkTabs;
