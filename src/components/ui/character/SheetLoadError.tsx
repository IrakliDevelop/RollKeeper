'use client';

import { Button } from '@/components/ui/forms/button';

/** Recovery shared by the character sheet's section boundaries. */
export function SheetLoadError({ thing }: { thing: string }) {
  return (
    <div className="py-6 text-center">
      <p className="type-body text-muted">{`${thing} didn't load.`}</p>
      <Button
        type="button"
        className="mt-3"
        onClick={() => window.location.reload()}
      >
        Reload page
      </Button>
    </div>
  );
}
