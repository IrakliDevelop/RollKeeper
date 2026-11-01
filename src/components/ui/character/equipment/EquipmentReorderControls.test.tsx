import { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EquipmentReorderControls } from './EquipmentReorderControls';

afterEach(cleanup);

describe('EquipmentReorderControls', () => {
  it('keeps focus on the moved row when it reaches the last position', () => {
    function Rows() {
      const [names, setNames] = useState(['Alpha', 'Beta']);
      return (
        <div>
          {names.map((name, index) => (
            <div key={name} data-row={name}>
              <EquipmentReorderControls
                name={name}
                index={index}
                count={names.length}
                onMove={destination =>
                  setNames(current => {
                    const next = [...current];
                    next.splice(index, 1);
                    next.splice(destination, 0, name);
                    return next;
                  })
                }
              />
            </div>
          ))}
        </div>
      );
    }
    render(<Rows />);
    const row = screen.getByText('Alpha').closest('[data-row]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Move down' }));
    expect(within(row).getByRole('button', { name: 'Move up' })).toHaveFocus();
  });

  it('forgets a rejected move before a later prop change', async () => {
    const onMove = vi.fn();
    const { rerender } = render(
      <>
        <button>Elsewhere</button>
        <EquipmentReorderControls
          name="Alpha"
          index={0}
          count={3}
          onMove={onMove}
        />
      </>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }));
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    await new Promise(resolve => setTimeout(resolve, 0));
    rerender(
      <>
        <button>Elsewhere</button>
        <EquipmentReorderControls
          name="Alpha"
          index={1}
          count={3}
          onMove={onMove}
        />
      </>
    );
    expect(elsewhere).toHaveFocus();
  });
});
