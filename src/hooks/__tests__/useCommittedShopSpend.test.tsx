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
});
