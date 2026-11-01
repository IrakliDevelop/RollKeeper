import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiceSetEditor } from '../DiceSetEditor';
import { DEFAULT_DICE_SET, parseDiceSet } from '@/utils/diceSet';

vi.mock('../dice-settings/DicePreview', () => ({
  DicePreview: () => <div>Dice preview</div>,
}));
afterEach(cleanup);
function Harness() {
  const [value, setValue] = useState(DEFAULT_DICE_SET);
  return (
    <>
      <DiceSetEditor value={value} onChange={setValue} />
      <output data-testid="saved-dice">{JSON.stringify(value)}</output>
    </>
  );
}
function saved() {
  return parseDiceSet(
    JSON.parse(screen.getByTestId('saved-dice').textContent ?? '{}')
  );
}
function advanced() {
  fireEvent.click(screen.getByText('Advanced dice settings'));
}
describe('dice configuration editor', () => {
  it('updates a preset and size immediately and preserves roll preferences', () => {
    const { unmount } = render(<Harness />);
    fireEvent.change(screen.getByRole('slider', { name: 'Dice volume' }), {
      target: { value: '.6' },
    });
    const presets = screen.getByRole('group', { name: 'Dice presets' });
    fireEvent.click(within(presets).getByRole('button', { name: /Oak/ }));
    fireEvent.change(screen.getByRole('slider', { name: 'Dice size' }), {
      target: { value: '1.7' },
    });
    expect(saved()?.skin.material).toBe('wood');
    expect(saved()?.dieScale).toBe(1.7);
    expect(saved()?.options?.sound).toBe(0.6);
    const last = saved();
    unmount();
    expect(last?.dieScale).toBe(1.7);
  });
  it('validates custom faces before applying them', () => {
    render(<Harness />);
    advanced();
    fireEvent.change(screen.getByLabelText('Face labels'), {
      target: { value: 'one, two' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply face labels' }));
    expect(saved()?.options?.labels).toBeUndefined();
    expect(
      screen.getByText('Enter 6 labels with no more than 16 characters each.')
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText('Face labels'), {
      target: { value: 'I, II, III, IV, V, VI' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply face labels' }));
    expect(saved()?.options?.labels?.d6).toEqual([
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Use standard faces' }));
    expect(saved()?.options?.labels?.d6).toBeUndefined();
  });
  it('rejects an invalid import without replacing the current dice and imports valid settings', () => {
    render(<Harness />);
    advanced();
    fireEvent.change(screen.getByLabelText('Import a dice set'), {
      target: {
        value: JSON.stringify({ ...DEFAULT_DICE_SET, options: { sound: 7 } }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import dice set' }));
    expect(saved()).toEqual(DEFAULT_DICE_SET);
    expect(screen.getByText(/This dice set has invalid/)).toBeVisible();
    fireEvent.change(screen.getByLabelText('Import a dice set'), {
      target: {
        value: JSON.stringify({
          ...DEFAULT_DICE_SET,
          options: { sound: 0.5, reducedMotion: 'always' },
        }),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import dice set' }));
    expect(saved()?.options).toEqual({ sound: 0.5, reducedMotion: 'always' });
  });
  it('reports clipboard failure without losing the dice set', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    render(<Harness />);
    advanced();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy dice set' }));
    });
    expect(screen.getByText(/Could not copy/)).toBeVisible();
    expect(saved()).toEqual(DEFAULT_DICE_SET);
  });
});
