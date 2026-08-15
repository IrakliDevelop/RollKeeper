'use client';

import { useRef, useState } from 'react';
import { Download, ShieldCheck, Upload } from 'lucide-react';

import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { browserRecoveryRepository } from '@/lib/browserRecoveryRepository';
import {
  activateRecoveryGeneration,
  captureDeviceBackup,
  downloadRawRecoveryEntries,
  initiateDeviceBackupDownload,
  restoreRecoveryEntries,
  stageRecoveryBundle,
  type StagedRecoveryGeneration,
} from '@/lib/deviceRecovery';
import { APP_VERSION } from '@/utils/constants';

export function DeviceRecoveryControls() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState<StagedRecoveryGeneration | null>(
    null
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    try {
      const bundle = await captureDeviceBackup(window.localStorage, {
        appVersion: APP_VERSION,
        runId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      });
      await initiateDeviceBackupDownload(bundle, browserRecoveryRepository);
      setStatus('Full device backup download initiated.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not create device backup.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const staged = await stageRecoveryBundle(
        await file.text(),
        window.localStorage,
        browserRecoveryRepository
      );
      const quarantined = new Set(
        staged.preview.quarantine.map(entry => entry.key)
      );
      setSelectedKeys(
        new Set(
          staged.bundle.entries
            .filter(entry => !quarantined.has(entry.key))
            .map(entry => entry.key)
        )
      );
      setActivated(false);
      setGeneration(staged);
      setStatus('Recovery bundle validated and staged inactive.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not import recovery bundle.'
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleActivate = async () => {
    if (!generation) return;
    setBusy(true);
    try {
      await activateRecoveryGeneration(
        generation.runId,
        true,
        browserRecoveryRepository
      );
      setActivated(true);
      setStatus('Recovery generation activated. Active app data is unchanged.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Activation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = () => {
    if (!generation || !activated || selectedKeys.size === 0) return;
    if (
      !window.confirm(
        'Restore selected missing values? Existing values and conflicts will not be overwritten.'
      )
    ) {
      return;
    }
    const result = restoreRecoveryEntries(
      generation.bundle,
      window.localStorage,
      [...selectedKeys]
    );
    setStatus(
      `Restored ${result.restored.length}; preserved ${result.conflicts.length} conflict(s); quarantined ${result.quarantined.length}.`
    );
  };

  const toggleKey = (key: string, checked: boolean) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          leftIcon={<ShieldCheck size={18} />}
          onClick={handleDownload}
          disabled={busy}
        >
          Download device backup
        </Button>
        <Button
          variant="outline"
          leftIcon={<Upload size={18} />}
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          Import recovery bundle
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0];
            if (file) void handleImport(file);
          }}
        />
      </div>
      {status && <p className="text-muted mt-2 text-sm">{status}</p>}
      {error && <p className="text-accent-red-text mt-2 text-sm">{error}</p>}

      <Dialog
        open={generation !== null}
        onOpenChange={open => {
          if (!open) setGeneration(null);
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Recovery preview</DialogTitle>
            <DialogDescription>
              This bundle is staged separately. Nothing below overwrites an
              existing browser value.
            </DialogDescription>
          </DialogHeader>
          {generation && (
            <DialogBody className="space-y-4">
              <div className="border-divider bg-surface-secondary grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm sm:grid-cols-4">
                <span>{generation.preview.entryCount} entries</span>
                <span>{generation.preview.conflictCount} conflicts</span>
                <span>{generation.preview.quarantineCount} quarantined</span>
                <span>{generation.preview.totalBytes} bytes</span>
              </div>
              <div className="space-y-2">
                {generation.bundle.entries.map(entry => {
                  const quarantined = generation.preview.quarantine.find(
                    candidate => candidate.key === entry.key
                  );
                  const version = generation.preview.versions[entry.key];
                  const conflicts = generation.preview.conflicts.includes(
                    entry.key
                  );
                  return (
                    <Checkbox
                      key={entry.key}
                      checked={selectedKeys.has(entry.key)}
                      onCheckedChange={checked => toggleKey(entry.key, checked)}
                      disabled={Boolean(quarantined)}
                      label={entry.key}
                      description={
                        quarantined
                          ? `Quarantined: ${quarantined.reason}`
                          : [
                              `${entry.byteCount} bytes`,
                              entry.classification,
                              version === undefined
                                ? 'legacy/unversioned'
                                : `version ${version}`,
                              conflicts ? 'collision preserved' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                      }
                    />
                  );
                })}
              </div>
              {generation.preview.quarantineCount > 0 && (
                <Button
                  variant="outline"
                  leftIcon={<Download size={16} />}
                  onClick={() =>
                    downloadRawRecoveryEntries(
                      generation.bundle,
                      generation.preview.quarantine.map(entry => entry.key)
                    )
                  }
                >
                  Download quarantined raw data
                </Button>
              )}
            </DialogBody>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={handleActivate}
              disabled={busy || activated}
            >
              {activated ? 'Generation active' : 'Activate generation'}
            </Button>
            <Button
              variant="success"
              onClick={handleRestore}
              disabled={busy || !activated || selectedKeys.size === 0}
            >
              Restore selected entries
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
