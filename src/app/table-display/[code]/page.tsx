import { Suspense } from 'react';
import type { Metadata } from 'next';

import { TableDisplayShell } from '@/components/ui/campaign/table/display/TableDisplayShell';

export const metadata: Metadata = {
  title: 'Table display',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

/**
 * PR05: the persistent campaign table display (outside `/dm`, so no DM
 * sync providers). The capability arrives in the URL fragment and never
 * reaches the server through this page request.
 */
export default async function TableDisplayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <Suspense fallback={null}>
      <TableDisplayShell code={code} />
    </Suspense>
  );
}
