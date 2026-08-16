'use client';

import { useEffect, useState } from 'react';
import { Database, Download, RotateCcw, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { CharacterRecoveryExportControls } from '@/components/ui/feedback/CharacterRecoveryExportControls';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  captureDeviceBackup,
  initiateDeviceBackupDownload,
  type DeviceBackupV1,
} from '@/lib/deviceRecovery';
import {
  hasCharacterCutoverSelection,
  isCharacterCutoverDeploymentEnabled,
  markCharacterCutoverActivated,
  readCharacterCutoverSelection,
  selectCharacterCutover,
} from '@/lib/indexeddb/characterCutoverSelection';
import { APP_VERSION } from '@/utils/constants';

export function CharacterStorageMigrationControls() {
  const [preview, setPreview] = useState<DeviceBackupV1 | null>(null);
  const [selected, setSelected] = useState(false);
  const [active, setActive] = useState(false);
  const [recoveryRunId, setRecoveryRunId] = useState<string | undefined>();
  const [captureRunId, setCaptureRunId] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deploymentEnabled = isCharacterCutoverDeploymentEnabled();

  useEffect(() => {
    if (!deploymentEnabled) return;
    const isSelected = hasCharacterCutoverSelection(localStorage, 'guest');
    setSelected(isSelected);
    if (!isSelected) return;
    const selection = readCharacterCutoverSelection(localStorage, 'guest');
    setRecoveryRunId(selection?.recoveryRunId);
    if (
      !selection?.recoveryManifestHash ||
      !selection.recoveryRunId ||
      !selection.recoveryCreatedAt
    ) {
      setError('Migration selection is missing its recovery receipt metadata.');
      return;
    }
    const recovery = {
      manifestHash: selection.recoveryManifestHash,
      runId: selection.recoveryRunId,
      createdAt: selection.recoveryCreatedAt,
    };
    let cancelled = false;
    const inspect = async () => {
      const { openRollkeeperDatabase } = await import(
        '@/lib/indexeddb/localDatabase'
      );
      const { readCharacterAuthority } = await import(
        '@/lib/indexeddb/characterAuthority'
      );
      const database = await openRollkeeperDatabase();
      try {
        const authority = await readCharacterAuthority(database, 'guest');
        if (authority.authority === 'indexedDB') {
          if (cancelled) return;
          setActive(true);
          setCaptureRunId(authority.generation);
          setReady(false);
          setError(null);
          setStatus(
            `IndexedDB is authoritative at cutover epoch ${authority.epoch}.`
          );
          return;
        }
      } finally {
        database.close();
      }
      const { inspectCharacterCutoverReadiness } = await import(
        '@/lib/indexeddb/characterCutoverControl'
      );
      const inspection = await inspectCharacterCutoverReadiness({
        factory: indexedDB,
        storage: localStorage,
        namespace: 'guest',
        recoveryManifestHash: recovery.manifestHash,
        recoveryRunId: recovery.runId,
        recoveryCreatedAt: recovery.createdAt,
        appVersion: APP_VERSION,
        recoveryGate: browserRecoveryRepository,
      });
      if (cancelled) return;
      setReady(inspection.ready);
      setCaptureRunId(inspection.generation);
      setError(null);
      setStatus(
        inspection.ready
          ? 'Character migration is ready for final cutover confirmation.'
          : 'Character migration is still preparing or blocked by a safety gate.'
      );
    };
    const runInspection = () => {
      void inspect().catch(cause => {
        if (cancelled) return;
        setStatus(
          'Character migration is still preparing or requires recovery.'
        );
        setError(cause instanceof Error ? cause.message : String(cause));
      });
    };
    window.addEventListener(
      'rollkeeper:character-bootstrap-complete',
      runInspection
    );
    runInspection();
    return () => {
      cancelled = true;
      window.removeEventListener(
        'rollkeeper:character-bootstrap-complete',
        runInspection
      );
    };
  }, [deploymentEnabled]);

  if (!deploymentEnabled) return null;

  const handlePreview = async () => {
    setBusy(true);
    setError(null);
    try {
      const bundle = await captureDeviceBackup(localStorage, {
        appVersion: APP_VERSION,
        runId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
      setPreview(bundle);
      setStatus('Preview created. No storage authority has changed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadAndSelect = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await initiateDeviceBackupDownload(preview, browserRecoveryRepository);
      if (
        !window.confirm(
          'The recovery download was initiated. Explicitly prepare this browser profile for character IndexedDB migration? LocalStorage remains authoritative until a separate final confirmation.'
        )
      ) {
        setStatus('Recovery downloaded; migration was not selected.');
        return;
      }
      selectCharacterCutover(localStorage, 'guest', true, undefined, {
        manifestHash: preview.manifestHash,
        runId: preview.runId,
        createdAt: preview.createdAt,
      });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    const selection = readCharacterCutoverSelection(localStorage, 'guest');
    if (
      !selection?.recoveryManifestHash ||
      !selection.recoveryRunId ||
      !selection.recoveryCreatedAt
    )
      return;
    if (
      !window.confirm(
        'Switch this browser profile’s character family to IndexedDB authority now? Current localStorage mirrors and immutable captures will be retained.'
      )
    )
      return;
    setBusy(true);
    try {
      const { activatePreparedCharacterCutover } = await import(
        '@/lib/indexeddb/characterCutoverControl'
      );
      const authority = await activatePreparedCharacterCutover({
        factory: indexedDB,
        storage: localStorage,
        namespace: 'guest',
        recoveryManifestHash: selection.recoveryManifestHash,
        recoveryRunId: selection.recoveryRunId,
        recoveryCreatedAt: selection.recoveryCreatedAt,
        appVersion: APP_VERSION,
        recoveryGate: browserRecoveryRepository,
        confirmed: true,
        now: () => new Date().toISOString(),
      });
      markCharacterCutoverActivated(
        localStorage,
        'guest',
        authority.epoch,
        authority.generation
      );
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  const handleRollback = async () => {
    if (
      !window.confirm(
        'Attempt rollback only if every current localStorage mirror exactly matches the active IndexedDB generation?'
      )
    )
      return;
    setBusy(true);
    try {
      const [
        { openRollkeeperDatabase },
        {
          readCharacterAuthority,
          rollbackCharacterAuthority,
          verifyCharacterRollbackGenerationAfterReopen,
        },
      ] = await Promise.all([
        import('@/lib/indexeddb/localDatabase'),
        import('@/lib/indexeddb/characterAuthority'),
      ]);
      const database = await openRollkeeperDatabase();
      let authority;
      try {
        authority = await readCharacterAuthority(database, 'guest');
        if (authority.authority !== 'indexedDB') return;
      } finally {
        database.close();
      }
      const reopenVerified = await verifyCharacterRollbackGenerationAfterReopen(
        indexedDB,
        'guest',
        authority.generation,
        authority.epoch
      );
      const reopened = await openRollkeeperDatabase();
      try {
        const result = await rollbackCharacterAuthority(
          reopened,
          localStorage,
          {
            namespace: 'guest',
            expectedEpoch: authority.epoch,
            confirmed: true,
            reopenVerified,
            now: () => new Date().toISOString(),
          }
        );
        if (result.state === 'RECOVERY_REQUIRED') {
          setError(
            'Mirror parity could not be proven. IndexedDB remains authoritative and recovery is required.'
          );
          return;
        }
        window.location.reload();
      } finally {
        reopened.close();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="border-divider bg-surface-secondary mt-4 rounded-lg border p-4">
      <h2 className="text-heading text-sm font-semibold">
        Character IndexedDB migration
      </h2>
      <p className="text-muted mb-3 text-sm">
        Optional for this browser profile. Login and navigation never select it.
      </p>
      {!selected && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            leftIcon={<Database size={18} />}
            onClick={handlePreview}
            disabled={busy}
          >
            Preview character migration
          </Button>
          {preview && (
            <Button
              variant="warning"
              leftIcon={<Download size={18} />}
              onClick={handleDownloadAndSelect}
              disabled={busy}
            >
              Download recovery and select migration
            </Button>
          )}
        </div>
      )}
      {preview && (
        <p className="text-muted mt-2 text-sm">
          {preview.validation.entryCount} entries ·{' '}
          {preview.validation.totalBytes} bytes ·{' '}
          {preview.validation.malformedJsonCount +
            preview.validation.futureVersionCount}{' '}
          quarantined
        </p>
      )}
      {selected && !active && ready && (
        <Button
          variant="warning"
          leftIcon={<ShieldCheck size={18} />}
          onClick={handleActivate}
          disabled={busy}
        >
          Confirm IndexedDB cutover
        </Button>
      )}
      {active && (
        <Button
          variant="outline"
          leftIcon={<RotateCcw size={18} />}
          onClick={handleRollback}
          disabled={busy}
        >
          Verify mirrors and roll back
        </Button>
      )}
      {selected && (
        <CharacterRecoveryExportControls
          namespace="guest"
          runId={captureRunId ?? recoveryRunId}
        />
      )}
      {status && <p className="text-muted mt-2 text-sm">{status}</p>}
      {error && <p className="text-accent-red-text mt-2 text-sm">{error}</p>}
    </section>
  );
}
