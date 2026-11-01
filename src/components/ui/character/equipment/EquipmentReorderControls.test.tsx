import { useState } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
});
