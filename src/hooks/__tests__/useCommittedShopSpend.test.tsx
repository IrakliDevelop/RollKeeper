import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  useCommittedShopSpend,
  type CommittedShopSpend,
} from '@/hooks/useCommittedShopSpend';

function Probe(props: {
  characterId: string;
  pendingTransfers: { id: string; costCopper?: number }[] | undefined;
  appliedTransferIds: string[];
  now?: () => number;
  onState: (state: CommittedShopSpend) => void;
}) {
  props.onState(useCommittedShopSpend(props));
  return null;
}

describe('useCommittedShopSpend', () => {
  beforeEach(() => sessionStorage.clear());

  it('counts a recorded commit the queue has not shown yet', () => {
    let latest!: CommittedShopSpend;
    render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    expect(latest.committedCopper).toBe(4000);
  });

  it('survives a remount (the reload case)', () => {
    let latest!: CommittedShopSpend;
    const tree = render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    tree.unmount();

    render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(4000);
  });

  it('counts a queued transfer once, not twice, when both sources know it', () => {
    let latest!: CommittedShopSpend;
    const { rerender } = render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    rerender(
      <Probe
        characterId="char-1"
        pendingTransfers={[{ id: 't-1', costCopper: 4000 }]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(4000);
  });

  it('counts a queued transfer this tab never recorded (reload before the poll)', () => {
    let latest!: CommittedShopSpend;
    render(
      <Probe
        characterId="char-1"
        pendingTransfers={[{ id: 't-9', costCopper: 250 }]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(250);
  });

  it('drops a commit once its debit has been applied', () => {
    let latest!: CommittedShopSpend;
    const { rerender } = render(
      <Probe
        characterId="char-1"
        pendingTransfers={[{ id: 't-1', costCopper: 4000 }]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    rerender(
      <Probe
        characterId="char-1"
        pendingTransfers={[{ id: 't-1', costCopper: 4000 }]}
        appliedTransferIds={['t-1']}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(0);
  });

  it('drops a commit that was seen in the queue and then left it', () => {
    let latest!: CommittedShopSpend;
    const { rerender } = render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    rerender(
      <Probe
        characterId="char-1"
        pendingTransfers={[{ id: 't-1', costCopper: 4000 }]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    rerender(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(0);
  });

  it('expires a receipt the queue never showed within 30 minutes', () => {
    let latest!: CommittedShopSpend;
    let clock = 1_000_000;
    const { rerender } = render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        now={() => clock}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    clock += 31 * 60 * 1000;
    rerender(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        now={() => clock}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(0);
  });

  it('keeps each character’s receipts separate', () => {
    let latest!: CommittedShopSpend;
    const tree = render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    tree.unmount();
    render(
      <Probe
        characterId="char-2"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(0);
  });

  it('a roster switch on rerender (not remount) does not corrupt the new character’s persisted receipts', () => {
    // char-2's own receipt from an earlier session — not `seen`, so under a
    // correct fresh read it survives its own sweep unchanged.
    const recentAt = 1_000_000;
    sessionStorage.setItem(
      'rollkeeper-vtt-committed-spend:char-2',
      JSON.stringify({ 't-9': { costCopper: 999, at: recentAt, seen: false } })
    );

    let latest!: CommittedShopSpend;
    const { rerender } = render(
      <Probe
        characterId="char-1"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        now={() => recentAt}
        onState={s => (latest = s)}
      />
    );
    act(() => latest.recordCommit({ costCopper: 4000, transferIds: ['t-1'] }));
    // The queue catches up to char-1's commit — its receipt becomes
    // `seen: true`, the in-flight state Finding 1 needs to reproduce.
    rerender(
      <Probe
        characterId="char-1"
        pendingTransfers={[{ id: 't-1', costCopper: 4000 }]}
        appliedTransferIds={[]}
        now={() => recentAt}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(4000);

    // Switch characters on a RERENDER, not a remount, while char-1's
    // receipt is `seen: true` and about to be swept against char-2's empty
    // queue. The stale-`receipts`-variable bug would sweep char-1's data
    // (dropping it) and persist the empty result under char-2's key.
    rerender(
      <Probe
        characterId="char-2"
        pendingTransfers={[]}
        appliedTransferIds={[]}
        now={() => recentAt}
        onState={s => (latest = s)}
      />
    );

    expect(latest.committedCopper).toBe(999);
    expect(
      JSON.parse(
        sessionStorage.getItem('rollkeeper-vtt-committed-spend:char-2')!
      )
    ).toEqual({ 't-9': { costCopper: 999, at: recentAt, seen: false } });
  });

  it('does not drop a seen receipt while the queue is unknown (fresh mount before the first poll)', () => {
    sessionStorage.setItem(
      'rollkeeper-vtt-committed-spend:char-1',
      JSON.stringify({ 't-1': { costCopper: 4000, at: 1, seen: true } })
    );
    let latest!: CommittedShopSpend;
    render(
      <Probe
        characterId="char-1"
        pendingTransfers={undefined}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(4000);
  });

  it('still drops a receipt whose debit already landed even while the queue is unknown', () => {
    sessionStorage.setItem(
      'rollkeeper-vtt-committed-spend:char-1',
      JSON.stringify({ 't-1': { costCopper: 4000, at: 1, seen: true } })
    );
    let latest!: CommittedShopSpend;
    render(
      <Probe
        characterId="char-1"
        pendingTransfers={undefined}
        appliedTransferIds={['t-1']}
        onState={s => (latest = s)}
      />
    );
    expect(latest.committedCopper).toBe(0);
  });

  it('stamps the whole cost on the first transfer id of a multi-unit commit, not each one', () => {
    let latest!: CommittedShopSpend;
    render(
      <Probe
        characterId="char-1"
        pendingTransfers={[
          { id: 't-0', costCopper: 4000 },
          { id: 't-1', costCopper: 0 },
        ]}
        appliedTransferIds={[]}
        onState={s => (latest = s)}
      />
    );
    act(() =>
      latest.recordCommit({ costCopper: 4000, transferIds: ['t-0', 't-1'] })
    );
    expect(latest.committedCopper).toBe(4000);
  });
});
