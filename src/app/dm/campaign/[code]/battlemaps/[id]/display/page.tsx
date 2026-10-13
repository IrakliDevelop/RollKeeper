'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';

import { TableDisplayShell } from '@/components/ui/campaign/table/display/TableDisplayShell';

/**
 * Map-pinned display (PR05 E8, R4-F3): an old map-pinned URL is the
 * campaign display restricted to this map: `?dk=` is consumed and scrubbed
 * before any request, the descriptor binds the session nonce before any
 * mint, and only a presented scene adopted from this map is shown; anything
 * else is the neutral "Nothing is being shown on this map right now" cover.
 * No legacy access grant exists.
 */
export default function BattleMapDisplayPage() {
  const params = useParams();
  const code = params.code as string;
  const id = params.id as string;
  return (
    <Suspense fallback={null}>
      <TableDisplayShell code={code} mapId={id} />
    </Suspense>
  );
}
