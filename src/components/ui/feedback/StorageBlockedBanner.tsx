'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, ChevronDown, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

import { isStorageInMemoryOnly } from '@/lib/browserStorage';

// The blocked marker is set before hydration and never changes afterwards.
const subscribe = () => () => {};
const serverSnapshot = () => false;

/**
 * Warns, on every page but the landing page, that the browser blocks site
 * storage and RollKeeper is running on memory only. It cannot be dismissed:
 * the warning stays true for as long as the page is open.
 */
export function StorageBlockedBanner() {
  const blocked = useSyncExternalStore(
    subscribe,
    isStorageInMemoryOnly,
    serverSnapshot
  );
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const howToId = useId();

  if (!blocked || pathname === '/') return null;

  return (
    <div role="status" className="border-ember-border bg-ember-bg border-b">
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <AlertTriangle
          aria-hidden="true"
          className="text-ember-text mt-0.5 h-5 w-5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-heading text-sm font-medium">
            Site storage is blocked, so nothing here will be saved.
          </p>
          <p className="text-body text-sm">
            Characters and campaigns you create disappear when this page closes
            or reloads.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 -ml-4 pointer-coarse:h-11"
            aria-expanded={expanded}
            aria-controls={howToId}
            rightIcon={
              <ChevronDown
                aria-hidden="true"
                className={expanded ? 'h-4 w-4 rotate-180' : 'h-4 w-4'}
              />
            }
            onClick={() => setExpanded(open => !open)}
          >
            How to allow storage
          </Button>
          {expanded && (
            <div
              id={howToId}
              className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <p className="text-body max-w-2xl text-sm">
                Allow cookies and site data for this site in your browser
                settings, then reload. If RollKeeper is open inside another
                page, open it in its own tab.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="pointer-coarse:h-11"
                leftIcon={<RotateCw aria-hidden="true" className="h-4 w-4" />}
                onClick={() => window.location.reload()}
              >
                Reload page
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
