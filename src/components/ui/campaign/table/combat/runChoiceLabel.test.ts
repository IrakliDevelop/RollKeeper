import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { runChoiceLabels, runCreatedText } from './runChoiceLabel';

afterEach(cleanup);

const T1 = '2026-10-07T09:15:00.000Z';
const T2 = '2026-10-07T12:00:00.000Z';
const T3 = '2026-10-07T18:40:00.000Z';
const when = (iso: string) =>
  `${new Date(iso).toLocaleDateString()} ${new Date(iso).toLocaleTimeString(undefined, { timeStyle: 'short' })}`;
const run = (runId: string, label: string, createdAt: string) => ({
  runId,
  sceneId: 'scene-tavern',
  localWorkspaceId: 'w1',
  label,
  createdAt,
});
const labels = (runs: ReturnType<typeof run>[]) =>
  runChoiceLabels(runs, () => 'Tavern');

describe('FC-8 run choice ordinals (R4-2)', () => {
  it('orders by createdAt even when runId order is the opposite', () => {
    expect(
      labels([run('run-a', 'Ambush', T3), run('run-z', 'Ambush', T1)])
    ).toEqual([
      `Tavern · Ambush · ${when(T3)} · copy 2`,
      `Tavern · Ambush · ${when(T1)} · copy 1`,
    ]);
  });

  it('breaks createdAt ties by runId ascending', () => {
    expect(
      labels([run('run-b', 'Ambush', T1), run('run-a', 'Ambush', T1)])
    ).toEqual([
      `Tavern · Ambush · ${when(T1)} · copy 2`,
      `Tavern · Ambush · ${when(T1)} · copy 1`,
    ]);
  });

  it('numbers only colliding labels; a unique label gets no copy', () => {
    expect(
      labels([
        run('run-1', 'Ambush', T1),
        run('run-2', 'Parley', T2),
        run('run-3', 'Ambush', T3),
      ])
    ).toEqual([
      `Tavern · Ambush · ${when(T1)} · copy 1`,
      `Tavern · Parley · ${when(T2)}`,
      `Tavern · Ambush · ${when(T3)} · copy 2`,
    ]);
  });

  it('formats an invalid creation as no time', () => {
    expect(runCreatedText('nope')).toBeNull();
  });
});
