'use client';

import { Button } from '@/components/ui/forms/button';

/** Scoped fallback for the VTT screens: canvas state lives in the relay +
 * local store, so a full reload is lossless and beats the app-root
 * "Component Spell Failed!" page mid-session. */
export function VttErrorFallback() {
  return (
    <div className="bg-surface flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-heading text-lg font-semibold">
        The battle map hit an error.
      </p>
      <p className="text-muted text-sm">
        Your map is safe — reloading brings everything back.
      </p>
      <Button
        variant="primary"
        size="lg"
        onClick={() => window.location.reload()}
      >
        Reload map
      </Button>
    </div>
  );
}
