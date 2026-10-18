'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Map as MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { findTableSceneForMap } from '@/lib/table/combatLibrary';

import { currentAccount } from './combat/useSceneRunLinks';
import { tableWorkspaceHref } from './workspace/tableWorkspaceRoutes';

/** Campaign dashboard "Open Table" (W1 primary play entry). */
export function CampaignTableLauncher(props: { code: string }) {
  return (
    <Link href={tableWorkspaceHref(props.code, {})}>
      <Button
        variant="primary"
        size="sm"
        leftIcon={<LayoutDashboard size={14} />}
      >
        Open Table
      </Button>
    </Link>
  );
}

/** W7: encounter library / header "Prepare on map". */
export function PrepareOnMapLink(props: {
  campaignCode: string;
  encounterId: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={tableWorkspaceHref(props.campaignCode, {
        prepareEncounter: props.encounterId,
      })}
      onClick={event => event.stopPropagation()}
    >
      <Button variant="outline" size="sm" fullWidth={!props.compact}>
        <MapIcon size={14} aria-hidden="true" />
        Prepare on map
      </Button>
    </Link>
  );
}

/**
 * W8: the original map route stays the original editor; it links its adopted scene ("Open in Table", read-only IndexedDB lookup that
 * never creates the database) or the Scenes panel ("Use in Table").
 */
export type TableMapEntry =
  | { kind: 'open'; href: string }
  | { kind: 'use'; href: string };

/**
 * The map's Table entry (read-only IndexedDB lookup that never creates the
 * database): `open` when the map is on this Table, `use` otherwise, `null`
 * while unknown.
 */
export function useTableMapEntry(
  campaignCode: string,
  mapId: string
): TableMapEntry | null {
  const [target, setTarget] = useState<TableMapEntry | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const found = await findTableSceneForMap({
        account: await currentAccount(),
        campaignCode,
        mapId,
      });
      if (cancelled) return;
      setTarget(
        found
          ? {
              kind: 'open',
              href: tableWorkspaceHref(campaignCode, {
                scene: found.sceneId,
                tableWorkspace: found.defaultWorkspace
                  ? null
                  : found.localWorkspaceId,
              }),
            }
          : {
              kind: 'use',
              href: tableWorkspaceHref(campaignCode, { panel: 'scenes' }),
            }
      );
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [campaignCode, mapId]);
  return target;
}

export function TableMapEntryLink(props: {
  campaignCode: string;
  mapId: string;
  /** R4-5: Play-mode bar, icon below `lg`, text from `lg` (as Open display). */
  compact?: boolean;
}) {
  const target = useTableMapEntry(props.campaignCode, props.mapId);
  return <TableMapEntryLinkView target={target} compact={props.compact} />;
}

/** The link for an already looked-up {@link useTableMapEntry} result. */
export function TableMapEntryLinkView(props: {
  target: TableMapEntry | null;
  compact?: boolean;
}) {
  const { target } = props;
  if (!target) return null;
  const label = target.kind === 'open' ? 'Open in Table' : 'Use in Table';
  if (props.compact)
    return (
      <Link href={target.href} className="shrink-0">
        <Button
          variant="ghost"
          size="lg"
          leftIcon={<LayoutDashboard size={16} />}
          aria-label={label}
          className="min-h-[44px] min-w-[44px] px-2 text-xs lg:px-3"
        >
          <span className="hidden lg:inline">{label}</span>
        </Button>
      </Link>
    );
  return (
    <Link href={target.href}>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<LayoutDashboard size={14} />}
      >
        {target.kind === 'open' ? 'Open in Table' : 'Use in Table'}
      </Button>
    </Link>
  );
}
