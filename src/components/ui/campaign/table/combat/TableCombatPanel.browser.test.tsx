import '@/app/globals.css';

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';

import {
  openFixture,
  readySnapshot,
  repositories,
} from '@/lib/table/combat.fixture';
import type { TableRepository } from '@/lib/table/repository';

import { TableCombatPanel } from './TableCombatPanel';

/*
 * PR08 C1: a blur-commit must not move the participant rows between
 * pointerdown and pointerup. Real Chromium hit-testing and CDP input; jsdom
 * has no layout, so only this project can catch the lost click.
 */

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ players: [] }))
  );
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  repositories.splice(0).forEach(repository => repository.dispose());
  // Real IndexedDB persists across tests in the page: start each one empty.
  for (const { name } of await indexedDB.databases())
    if (name)
      await new Promise(resolve => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = request.onerror = request.onblocked = resolve;
      });
});

/** Keeps each real IndexedDB transaction busy for `ms` before it commits. */
function slowCommit(ms: number) {
  return (({ transaction }: { transaction: IDBTransaction }) => {
    const end = performance.now() + ms;
    const store = transaction.objectStore(transaction.objectStoreNames[0]!);
    const spin = () => {
      if (performance.now() < end) store.count().onsuccess = spin;
    };
    spin();
  }) as never;
}

async function setup(delayMs: number) {
  const repository = await openFixture({
    factory: indexedDB,
    beforeTransactionCommit: delayMs ? slowCommit(delayMs) : undefined,
  });
  render(
    <div style={{ position: 'relative', height: 800 }}>
      <TableCombatPanel
        repository={repository}
        sceneId="scene-1"
        campaignCode="CAMP"
        dmId="dm-1"
        controlSession={null}
        controlEpoch={0}
        liveUnavailable={false}
        requestedRunId={null}
      />
    </div>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'New run' }));
  const create = await screen.findByRole('dialog', { name: 'New scene run' });
  fireEvent.change(within(create).getByLabelText('Run label'), {
    target: { value: 'Layout' },
  });
  fireEvent.click(within(create).getByRole('button', { name: 'Create run' }));
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'New scene run' })).toBeNull()
  );
  fireEvent.click(
    await screen.findByRole('button', { name: 'Choose participants' })
  );
  const choose = await screen.findByRole('dialog', {
    name: 'Choose participants',
  });
  for (const name of ['Goblin', 'Knight'])
    fireEvent.click(within(choose).getByRole('checkbox', { name }));
  fireEvent.click(
    within(choose).getByRole('button', { name: 'Save participants' })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Choose participants' })
    ).toBeNull()
  );
  await waitFor(() => expect(screen.queryByText('Saving…')).toBeNull());
  return repository;
}

function goblin(repository: TableRepository) {
  return readySnapshot(repository)
    .encounters.find(run => run.label === 'Layout')!
    .participants.find(participant => participant.actorId === 'goblin')!;
}

const hideSwitch = () =>
  screen.getByRole('switch', { name: 'Hide Goblin from players' });

/** Edits Goblin's initiative, then clicks Hide once (blur-commit + click). */
async function initiativeThenHide(holdMs: number) {
  await userEvent.click(screen.getByLabelText('Initiative for Goblin'));
  await userEvent.keyboard('{Control>}a{/Control}14');
  const top = hideSwitch().getBoundingClientRect().top;
  await userEvent.click(hideSwitch(), { delay: holdMs } as never);
  return top;
}

describe('Table combat panel: a status line never moves the rows (C1)', () => {
  for (const [name, delayMs, holdMs] of [
    ['fast save, instant click', 0, 0],
    ['slow save, instant click', 20, 0],
    ['slow save, human click', 20, 80],
  ] as const) {
    it(`keeps the first Hide click after an initiative edit (${name})`, async () => {
      const repository = await setup(delayMs);
      const top = await initiativeThenHide(holdMs);
      await waitFor(() => expect(goblin(repository).hidden).toBe(true));
      expect(goblin(repository).initiative).toBe(14);
      await waitFor(() =>
        expect(hideSwitch()).toHaveAttribute('aria-checked', 'true')
      );
      expect(hideSwitch().getBoundingClientRect().top).toBe(top);
    });
  }

  it('keeps the Hide click when the initiative save fails (unsaved line with Retry)', async () => {
    const repository = await setup(0);
    const write = repository.mutateWorkspace.bind(repository);
    let failed = false;
    vi.spyOn(repository, 'mutateWorkspace').mockImplementation(
      async (...args) => {
        const command = args[3]?.digestSource as { type?: string } | undefined;
        if (failed || command?.type !== 'combat.setInitiative')
          return write(...args);
        failed = true;
        await new Promise(resolve => setTimeout(resolve, 20));
        return { status: 'failed', reason: 'indexeddb-unavailable' };
      }
    );
    // The failure line (taller, with Retry) appears while the button is down:
    // a long press, and timestamps instead of a race with the click promise.
    let shownAt = Number.POSITIVE_INFINITY;
    let releasedAt = Number.NEGATIVE_INFINITY;
    const observer = new MutationObserver(() => {
      if (
        shownAt === Number.POSITIVE_INFINITY &&
        document.body.textContent?.includes("Goblin initiative wasn't saved")
      )
        shownAt = performance.now();
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    const onRelease = () => {
      releasedAt = performance.now();
    };
    document.addEventListener('pointerup', onRelease, true);
    const top = await initiativeThenHide(150);
    await waitFor(() => expect(goblin(repository).hidden).toBe(true));
    observer.disconnect();
    document.removeEventListener('pointerup', onRelease, true);
    expect(shownAt).toBeLessThan(releasedAt);
    expect(goblin(repository).initiative).toBeNull();
    await waitFor(() =>
      expect(hideSwitch()).toHaveAttribute('aria-checked', 'true')
    );
    expect(hideSwitch().getBoundingClientRect().top).toBe(top);
  });
});
