'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, Swords } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import type { TableSceneRunLink } from '@/lib/table/combatLibrary';

import { tableWorkspaceHref } from '../workspace/tableWorkspaceRoutes';
import { useSceneRunLinks } from './useSceneRunLinks';

function runHref(campaignCode: string, link: TableSceneRunLink): string {
  return tableWorkspaceHref(campaignCode, {
    scene: link.sceneId,
    run: link.runId,
    tableWorkspace: link.defaultWorkspace ? null : link.localWorkspaceId,
  });
}

/**
 * Encounter-library affordance: opens the Table scene run copied or adopted
 * from this encounter (saved on this device) at the canonical workspace URL.
 * Several copies → an explicit selector (scene · run · created date).
 * Absent when there is none; the original encounter is never redirected.
 */
export function OpenSceneRunLink(props: {
  campaignCode: string;
  encounterId: string;
  compact?: boolean;
}) {
  const links = useSceneRunLinks(props.campaignCode, props.encounterId);
  const [open, setOpen] = useState(false);
  const link = links[0];
  if (!link) return null;
  if (links.length === 1) {
    return (
      <span className="flex min-w-0 flex-col">
        <Link
          href={runHref(props.campaignCode, link)}
          onClick={event => event.stopPropagation()}
        >
          <Button variant="outline" size="sm" fullWidth={!props.compact}>
            <Swords size={14} aria-hidden="true" />
            Open scene run
          </Button>
        </Link>
        <span className="text-faint text-[10px]">
          {`${link.label ?? 'Scene run'} · saved on this device`}
        </span>
      </span>
    );
  }
  const listId = `scene-runs-${props.encounterId}`;
  return (
    <span className="relative flex min-w-0 flex-col">
      <Button
        variant="outline"
        size="sm"
        fullWidth={!props.compact}
        aria-expanded={open}
        aria-controls={listId}
        onClick={event => {
          event.stopPropagation();
          setOpen(value => !value);
        }}
      >
        <Swords size={14} aria-hidden="true" />
        {`Open scene run (${links.length})`}
        <ChevronDown size={14} aria-hidden="true" />
      </Button>
      {open && (
        <ul
          id={listId}
          aria-label="Scene runs of this encounter"
          className="border-divider bg-surface-raised z-20 mt-1 flex flex-col gap-1 rounded-lg border p-1 shadow-lg"
        >
          {links.map(item => (
            <li key={`${item.localWorkspaceId}:${item.runId}`}>
              <Link
                href={runHref(props.campaignCode, item)}
                onClick={event => event.stopPropagation()}
                className="hover:bg-surface-secondary text-body block rounded px-2 py-1 text-xs"
              >
                {`${item.sceneName ?? 'Scene'} · ${item.label ?? 'Scene run'} · ${new Date(item.createdAt).toLocaleDateString()}`}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <span className="text-faint text-[10px]">saved on this device</span>
    </span>
  );
}
