'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/forms/button';

export default function TestErrorPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Test error from /test-error.');
  }

  return (
    <main className="bg-surface min-h-screen p-8">
      <h1 className="type-heading text-heading">Error page test</h1>
      <Button className="mt-4" onClick={() => setShouldThrow(true)}>
        Throw an error
      </Button>
    </main>
  );
}
