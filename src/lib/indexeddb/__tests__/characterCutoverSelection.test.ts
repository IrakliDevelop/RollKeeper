import { describe, expect, it, vi } from 'vitest';

import {
  CHARACTER_CUTOVER_SELECTION_PREFIX,
  characterCutoverSelectionKey,
  hasCharacterCutoverSelection,
  isBrowserCharacterCutoverParticipant,
  isCharacterCutoverDeploymentEnabled,
  isSelectedCharacterCutoverProfile,
  markCharacterCutoverActivated,
  readCharacterCutoverSelection,
  repairRecoveredCharacterSelectionFromEvidence,
  resolveCharacterCutoverNamespace,
  selectCharacterCutover,
  writeRecoveredCharacterSelectionMarker,
} from '@/lib/indexeddb/characterCutoverSelection';

describe('character cutover opt-in', () => {
  it('is deployment-disabled by default and recognizes only explicit true', () => {
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', undefined);
    expect(isCharacterCutoverDeploymentEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', 'false');
    expect(isCharacterCutoverDeploymentEnabled()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', 'true');
    expect(isCharacterCutoverDeploymentEnabled()).toBe(true);
  });

  it('requires explicit confirmation and isolates namespace selections', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    expect(() =>
      selectCharacterCutover(adapter, 'guest', false, () => 'now')
    ).toThrow(/explicit confirmation/i);
    expect(storage.size).toBe(0);

    selectCharacterCutover(adapter, 'guest', true, () => 'now');
    expect(hasCharacterCutoverSelection(adapter, 'guest')).toBe(true);
    expect(hasCharacterCutoverSelection(adapter, 'user:a')).toBe(false);
    expect([...storage.keys()]).toEqual([
      `${CHARACTER_CUTOVER_SELECTION_PREFIX}guest:character`,
    ]);
  });

  it('treats malformed, wrong-family, and wrong-namespace records as unselected', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    const key = `${CHARACTER_CUTOVER_SELECTION_PREFIX}guest:character`;
    for (const raw of [
      '{broken',
      JSON.stringify({ version: 1, namespace: 'user:a', family: 'character' }),
      JSON.stringify({ version: 1, namespace: 'guest', family: 'dm' }),
      JSON.stringify({ version: 2, namespace: 'guest', family: 'character' }),
    ]) {
      values.set(key, raw);
      expect(hasCharacterCutoverSelection(storage, 'guest')).toBe(false);
    }
  });

  it('retains recovery metadata and records activation without changing the selection identity', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    selectCharacterCutover(storage, 'user:a', true, () => 'selected', {
      manifestHash: 'manifest',
      runId: 'run',
      createdAt: 'created',
    });
    expect(readCharacterCutoverSelection(storage, 'user:a')).toMatchObject({
      namespace: 'user:a',
      selectedAt: 'selected',
      recoveryManifestHash: 'manifest',
      recoveryRunId: 'run',
      recoveryCreatedAt: 'created',
    });
    markCharacterCutoverActivated(storage, 'user:a', 4, 'generation-a');
    expect(readCharacterCutoverSelection(storage, 'user:a')).toMatchObject({
      namespace: 'user:a',
      activatedEpoch: 4,
      activatedGeneration: 'generation-a',
    });
    expect(characterCutoverSelectionKey('user:a')).toContain(
      'user:a:character'
    );
    expect(() => markCharacterCutoverActivated(storage, 'guest', 1)).toThrow(
      /missing/i
    );
  });

  it('combines deployment and selection checks without opting in from unrelated state', () => {
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', 'true');
    localStorage.clear();
    expect(isSelectedCharacterCutoverProfile(localStorage, 'guest')).toBe(
      false
    );
    selectCharacterCutover(localStorage, 'guest', true, () => 'now');
    expect(isSelectedCharacterCutoverProfile(localStorage, 'guest')).toBe(true);
    expect(isBrowserCharacterCutoverParticipant()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', 'false');
    expect(isBrowserCharacterCutoverParticipant()).toBe(false);
  });

  it('routes a browser profile through its sole account-scoped selection', () => {
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', 'true');
    localStorage.clear();
    selectCharacterCutover(localStorage, 'user:account-a', true, () => 'now');
    expect(resolveCharacterCutoverNamespace(localStorage)).toBe(
      'user:account-a'
    );
    expect(isBrowserCharacterCutoverParticipant()).toBe(true);

    selectCharacterCutover(localStorage, 'user:account-b', true, () => 'later');
    expect(resolveCharacterCutoverNamespace(localStorage)).toBeNull();
    expect(isBrowserCharacterCutoverParticipant()).toBe(false);
  });

  it('uses the default selection timestamp when none is injected', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    selectCharacterCutover(storage, 'guest', true);
    expect(JSON.parse(storage.setItem.mock.calls[0][1])).toMatchObject({
      selectedAt: expect.stringMatching(/^\d{4}-/),
    });
  });

  it('is not a browser participant when localStorage is unavailable', () => {
    vi.stubEnv('NEXT_PUBLIC_CHARACTER_INDEXEDDB_CUTOVER_ENABLED', 'true');
    vi.stubGlobal('localStorage', undefined);
    expect(isBrowserCharacterCutoverParticipant()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('writes a recovered marker from evidence and refuses backup authorization or mismatched continuation', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const evidence = {
      version: 1 as const,
      namespace: 'guest' as const,
      family: 'character' as const,
      selectedAt: 'activated-at',
      recoveryManifestHash: 'hash',
      recoveryRunId: 'run',
      recoveryCreatedAt: 'file-time',
      activatedGeneration: 'recovery:run',
      activatedEpoch: 1,
      committedAt: 'activated-at',
    };

    expect(() =>
      writeRecoveredCharacterSelectionMarker(storage, {
        ...evidence,
        playerBackupRunId: 'backup-run',
      })
    ).toThrow(/backup authorization/i);

    const written = writeRecoveredCharacterSelectionMarker(storage, evidence);
    expect(written).toMatchObject({
      recoveryRunId: 'run',
      activatedGeneration: 'recovery:run',
      activatedEpoch: 1,
    });
    expect(written.playerBackupRunId).toBeUndefined();

    expect(() =>
      repairRecoveredCharacterSelectionFromEvidence(storage, 'user:a', evidence)
    ).toThrow(/immutable evidence/i);

    expect(
      repairRecoveredCharacterSelectionFromEvidence(storage, 'guest', evidence)
    ).toMatchObject({ activatedGeneration: 'recovery:run' });

    values.set(
      characterCutoverSelectionKey('guest'),
      JSON.stringify({
        ...written,
        activatedGeneration: 'other',
      })
    );
    expect(() =>
      repairRecoveredCharacterSelectionFromEvidence(storage, 'guest', evidence)
    ).toThrow(/immutable evidence/i);

    values.set(
      characterCutoverSelectionKey('guest'),
      JSON.stringify({
        version: 1,
        namespace: 'guest',
        family: 'character',
        selectedAt: 'different',
        recoveryManifestHash: 'hash',
        recoveryRunId: 'run',
        recoveryCreatedAt: 'file-time',
      })
    );
    expect(() =>
      repairRecoveredCharacterSelectionFromEvidence(storage, 'guest', evidence)
    ).toThrow(/immutable evidence/i);

    values.delete(characterCutoverSelectionKey('guest'));
    expect(
      repairRecoveredCharacterSelectionFromEvidence(storage, 'guest', evidence)
        .activatedEpoch
    ).toBe(1);
  });
});
