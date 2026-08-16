'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import type { StorageNamespace } from '@/lib/indexeddb/shadowJournal';

function downloadJson(serialized: string, filename: string): void {
  const url = URL.createObjectURL(
    new Blob([serialized], { type: 'application/json' })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export function CharacterRecoveryExportControls({
  namespace,
  runId,
}: {
  namespace: StorageNamespace;
  runId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportCurrent = async () => {
    setBusy(true);
    setError(null);
    try {
      const [{ openRollkeeperDatabase }, { exportCurrentCharacterData }] =
        await Promise.all([
          import('@/lib/indexeddb/localDatabase'),
          import('@/lib/indexeddb/characterRecoveryExport'),
        ]);
      const database = await openRollkeeperDatabase();
      try {
        downloadJson(
          await exportCurrentCharacterData(database, localStorage, namespace),
          `rollkeeper-current-character_${Date.now()}.json`
        );
      } finally {
        database.close();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const exportCapture = async () => {
    if (!runId) return;
    setBusy(true);
    setError(null);
    try {
      const [{ openRollkeeperDatabase }, { exportMigrationRecovery }] =
        await Promise.all([
          import('@/lib/indexeddb/localDatabase'),
          import('@/lib/indexeddb/migrationRecovery'),
        ]);
      const database = await openRollkeeperDatabase();
      try {
        downloadJson(
          await exportMigrationRecovery(database, runId, namespace),
          `rollkeeper-immutable-character-capture_${runId}.json`
        );
      } finally {
        database.close();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          leftIcon={<Download size={18} />}
          onClick={exportCurrent}
          disabled={busy}
        >
          Download current character data
        </Button>
        <Button
          variant="outline"
          leftIcon={<Download size={18} />}
          onClick={exportCapture}
          disabled={busy || !runId}
        >
          Download immutable raw capture
        </Button>
      </div>
      {error && <p className="text-accent-red-text mt-2 text-sm">{error}</p>}
    </div>
  );
}
