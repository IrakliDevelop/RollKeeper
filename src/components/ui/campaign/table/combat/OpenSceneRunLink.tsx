'use client';

import Link from 'next/link';
import { Swords } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';

import { useSceneRunLinks } from './useSceneRunLinks';

/**
 * Encounter-library affordance: opens the adopted Table scene run for this
 * encounter (saved on this device). Absent when there is none; the original
 * encounter is never redirected or changed.
 */
export function OpenSceneRunLink(props: {
  campaignCode: string;
  encounterId: string;
  compact?: boolean;
}) {
  const links = useSceneRunLinks(props.campaignCode, props.encounterId);
  const link = links[0];
  if (!link) return null;
  const params = new URLSearchParams();
  if (!link.defaultWorkspace)
    params.set('tableWorkspace', link.localWorkspaceId);
  params.set('run', link.runId);
  const href = `/dm/campaign/${encodeURIComponent(props.campaignCode)}/table/${encodeURIComponent(link.sceneId)}?${params.toString()}`;
  return (
    <span className="flex min-w-0 flex-col">
      <Link href={href} onClick={event => event.stopPropagation()}>
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
