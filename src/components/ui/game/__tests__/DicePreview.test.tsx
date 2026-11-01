import { StrictMode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRoll,
  evaluate,
  type RollEvent,
  type RollSummary,
} from 'pollyroll';
import type { DiceTray } from 'pollyroll/render';
import { DicePreview } from '../dice-settings/DicePreview';
import { DEFAULT_DICE_SET } from '@/utils/diceSet';

// Model the SDK's asynchronous tray creation and StrictMode disposal. The
// actual WebGL renderer is outside the unit runner; roll events stay real.
vi.mock('pollyroll/react', async () => {
  const { useEffect, useState } = await import('react');
  return {
    useDiceTray: () => {
      const [tray, setTray] = useState<DiceTray | null>(null);
      useEffect(() => {
        const created = makeTray();
        setTray(created);
        return () => {
          created.dispose();
          setTray(null);
        };
      }, []);
      return tray;
    },
  };
});
vi.mock('pollyroll', async importOriginal => {
  const actual = await importOriginal<typeof import('pollyroll')>();
  return { ...actual, createRoll: vi.fn(actual.createRoll) };
});

type Pending = { event: RollEvent; resolve: (summary: RollSummary) => void };
const pending: Pending[] = [];
const trays: DiceTray[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  pending.length = 0;
  trays.length = 0;
});
function makeTray(): DiceTray {
  const tray: DiceTray = {
    supported: true,
    playRoll: vi.fn(
      (event: RollEvent) =>
        new Promise<RollSummary>(resolve => pending.push({ event, resolve }))
    ),
    setSkin: vi.fn(),
    setDieScale: vi.fn(),
    setSound: vi.fn(),
    clear: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  trays.push(tray);
  return tray;
}
afterEach(cleanup);

async function settleLatest() {
  const latest = pending.at(-1)!;
  await act(async () => latest.resolve(evaluate(latest.event)));
}

function preview(value = structuredClone(DEFAULT_DICE_SET)) {
  return (
    <StrictMode>
      <DicePreview value={value} />
    </StrictMode>
  );
}

describe('dice preview roll lifecycle', () => {
  it('plays one requested roll through StrictMode and ignores equivalent autosave renders', async () => {
    const { rerender } = render(preview());
    await waitFor(() => expect(pending).toHaveLength(1));
    await settleLatest();
    const rollCalls = vi.mocked(createRoll).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Roll preview' }));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(createRoll).toHaveBeenCalledTimes(rollCalls + 1);
    const requested = pending[1].event;
    expect(requested).not.toBe(pending[0].event);
    expect(requested.skin).toBeUndefined();
    expect(screen.getByRole('button', { name: 'Rolling…' })).toBeDisabled();
    for (let savedRender = 0; savedRender < 3; savedRender++)
      rerender(preview());
    expect(pending).toHaveLength(2);
    expect(createRoll).toHaveBeenCalledTimes(rollCalls + 1);
    await settleLatest();
    const result = screen.getByRole('status', {
      name: 'Preview roll result',
    }).textContent;
    rerender(preview());
    expect(pending).toHaveLength(2);
    expect(
      screen.getByRole('status', { name: 'Preview roll result' })
    ).toHaveTextContent(result!);
    fireEvent.click(screen.getByRole('button', { name: 'Roll preview' }));
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(createRoll).toHaveBeenCalledTimes(rollCalls + 2);
  });

  it('restyles and resizes the same roll without creating replacement results', async () => {
    const { rerender } = render(preview());
    await waitFor(() => expect(pending).toHaveLength(1));
    await settleLatest();
    const event = pending[0].event;
    const rolls = vi.mocked(createRoll).mock.calls.length;
    const changedSkin = {
      ...DEFAULT_DICE_SET,
      skin: { ...DEFAULT_DICE_SET.skin, color: '#aabbcc' },
    };
    rerender(preview(changedSkin));
    expect(pending).toHaveLength(1);
    rerender(preview({ ...changedSkin, dieScale: 2 }));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[1].event).toBe(event);
    rerender(
      preview({ ...changedSkin, dieScale: 2, options: { shadows: false } })
    );
    await waitFor(() => expect(pending).toHaveLength(3));
    expect(pending[2].event).toBe(event);
    expect(createRoll).toHaveBeenCalledTimes(rolls);
  });
});
