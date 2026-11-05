import { useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFocusAfterRemove } from './NpcLibrary.hooks';

function Harness({ visible }: { visible?: string[] }) {
  const [ids, setIds] = useState(['a', 'b']);
  const { fallbackRef, registerTarget, removeThenFocus } =
    useFocusAfterRemove(ids);
  return (
    <>
      {ids.map(id => (
        <button key={id} ref={registerTarget(id)}>
          {id}
        </button>
      ))}
      <button ref={fallbackRef}>Create</button>
      <button
        onClick={() =>
          removeThenFocus('a', visible ?? ids, () =>
            setIds(current => current.filter(id => id !== 'a'))
          )
        }
      >
        Remove a
      </button>
      <button onClick={() => removeThenFocus('a', ids, () => {})}>
        Remove nothing
      </button>
      <button
        onClick={() => setIds(current => current.filter(id => id !== 'a'))}
      >
        Drop a elsewhere
      </button>
      <button>Elsewhere</button>
    </>
  );
}

describe('useFocusAfterRemove', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('restores focus once a closing dialog drops it to the page', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    const b = screen.getByRole('button', { name: 'b' });
    expect(screen.queryByRole('button', { name: 'a' })).toBeNull();
    expect(b).toHaveFocus();

    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(b).toHaveFocus();
  });

  it('leaves focus alone when it has moved to another element', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));
    expect(screen.getByRole('button', { name: 'b' })).toHaveFocus();

    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(elsewhere).toHaveFocus();
  });

  it('focuses Create when the removed entry was not among the visible ones', () => {
    render(<Harness visible={['b']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove a' }));

    expect(screen.queryByRole('button', { name: 'a' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create' })).toHaveFocus();
  });

  it('forgets a removal that did not remove the entry', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove nothing' }));
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();

    fireEvent.click(screen.getByRole('button', { name: 'Drop a elsewhere' }));
    expect(screen.queryByRole('button', { name: 'a' })).toBeNull();
    expect(elsewhere).toHaveFocus();
  });
});
