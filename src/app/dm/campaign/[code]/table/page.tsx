import { Suspense } from 'react';

import { TableWorkspace } from '@/components/ui/campaign/table/workspace';

/**
 * PR06 W1: the unified Table workspace. The client workspace reads its query
 * (`scene`, `run`, `tableWorkspace`, `prepareEncounter`, `panel`) inside a
 * Suspense boundary, as required for `useSearchParams` in Next 16.
 */
export default async function TableWorkspacePage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await props.params;
  return (
    <Suspense
      fallback={
        <main className="bg-surface text-muted flex min-h-screen items-center justify-center p-6 text-sm">
          Loading Table…
        </main>
      }
    >
      <TableWorkspace campaignCode={code} />
    </Suspense>
  );
}
