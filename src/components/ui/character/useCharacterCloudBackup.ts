import { useEffect, useState } from 'react';

import type { CharacterCloudRow } from '@/lib/supabase/characterCloudCodec';
import {
  type ManualCharacterCloudContext,
  createManualCharacterCloud,
} from '@/lib/supabase/characterCloud';
import { downloadCharacterCloudRecovery } from '@/lib/supabase/characterCloudRecovery';

export interface CharacterCloudLocalSummary {
  id: string;
  name: string;
}

interface UseCharacterCloudBackupOptions {
  characters: readonly CharacterCloudLocalSummary[];
  onAddCharacter(character: unknown): boolean;
  injectedCloud?: ManualCharacterCloudContext;
}

export function useCharacterCloudBackup({
  characters,
  onAddCharacter,
  injectedCloud,
}: UseCharacterCloudBackupOptions) {
  const [createdCloud, setCreatedCloud] =
    useState<ManualCharacterCloudContext | null>(null);
  useEffect(() => {
    if (!injectedCloud) {
      setCreatedCloud(createManualCharacterCloud(window.localStorage));
    }
  }, [injectedCloud]);
  const cloud = injectedCloud ?? createdCloud;
  const [rows, setRows] = useState<CharacterCloudRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, operation: () => Promise<void>) => {
    if (!cloud || busy) return;
    setBusy(key);
    setError(null);
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cloud action failed.');
    } finally {
      setBusy(null);
    }
  };

  const load = () =>
    run('load', async () => {
      const account = await cloud!.getAccount();
      setRows(await cloud!.service.list(account));
      setStatus('Cloud backups loaded for the signed-in account.');
    });

  const backup = (character: CharacterCloudLocalSummary) =>
    run(`backup:${character.id}`, async () => {
      const account = await cloud!.getAccount();
      const target = account.email ?? account.id;
      if (
        !window.confirm(
          `Back up only ${character.name} to the signed-in account ${target}? Local data remains authoritative.`
        )
      ) {
        return;
      }
      const result = await cloud!.service.backup(character, account, {
        guestSelected: true,
        confirmedTargetAccountId: account.id,
      });
      setRows(current => [
        result.row,
        ...current.filter(row => row.id !== result.row.id),
      ]);
      setStatus(
        `${character.name} was refetched and fingerprint-verified in the cloud.`
      );
    });

  const verify = (character: CharacterCloudLocalSummary) =>
    run(`verify:${character.id}`, async () => {
      const account = await cloud!.getAccount();
      await cloud!.service.verify(character, account);
      setStatus(`${character.name} cloud copy matches current local data.`);
    });

  const archive = (row: CharacterCloudRow) =>
    run(`archive:${row.id}`, async () => {
      const account = await cloud!.getAccount();
      const result = await cloud!.service.archive(
        row.id,
        account,
        row.server_version
      );
      setRows(current =>
        current.map(candidate =>
          candidate.id === row.id
            ? {
                ...candidate,
                server_version: result.serverVersion,
                deleted_at: result.deletedAt,
              }
            : candidate
        )
      );
      setStatus(`${row.name} cloud copy was archived without deletion.`);
    });

  const restore = (row: CharacterCloudRow, asCopy: boolean) =>
    run(`restore:${row.id}:${asCopy}`, async () => {
      const account = await cloud!.getAccount();
      let serverVersion = row.server_version;
      if (row.deleted_at && !asCopy) {
        const restored = await cloud!.service.restoreCloudArchive(
          row.id,
          account,
          row.server_version
        );
        serverVersion = restored.serverVersion;
        setRows(current =>
          current.map(candidate =>
            candidate.id === row.id
              ? {
                  ...candidate,
                  server_version: restored.serverVersion,
                  deleted_at: null,
                }
              : candidate
          )
        );
      }
      const prepared = await cloud!.service.prepareRestore(
        row.id,
        account,
        characters,
        asCopy ? 'copy' : 'original'
      );
      if (prepared.plan.kind === 'quarantined') {
        downloadCharacterCloudRecovery(prepared.recovery);
        setStatus(
          `${row.name} was quarantined and its raw recovery download was initiated.`
        );
        return;
      }
      if (prepared.plan.character && !onAddCharacter(prepared.plan.character)) {
        throw new Error(
          'Local character changed during restore; nothing was overwritten.'
        );
      }
      if (prepared.plan.attachCloudLink) {
        cloud!.service.attachLink({
          ...prepared.link,
          serverVersion,
        });
      }
      setStatus(
        prepared.plan.kind === 'attach-link'
          ? `${row.name} was identical; its cloud link was attached without a duplicate.`
          : prepared.plan.kind === 'restore-copy'
            ? `${row.name} was restored as an unsynced local copy.`
            : `${row.name} was restored with its original ID.`
      );
    });

  const download = (row: CharacterCloudRow) =>
    run(`download:${row.id}`, async () => {
      const account = await cloud!.getAccount();
      const prepared = await cloud!.service.prepareRestore(
        row.id,
        account,
        characters,
        'copy'
      );
      downloadCharacterCloudRecovery(prepared.recovery);
      setStatus(`${row.name} recovery download was initiated.`);
    });

  return {
    archive,
    backup,
    busy,
    download,
    error,
    load,
    restore,
    rows,
    status,
    verify,
  };
}
