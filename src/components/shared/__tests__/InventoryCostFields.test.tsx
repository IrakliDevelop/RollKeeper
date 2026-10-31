// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InventoryCostFields } from '../InventoryCostFields';

afterEach(cleanup);

describe('InventoryCostFields', () => {
  it('keeps the linked item and quantity available in the shared form group', () => {
    const onChange = vi.fn();
    render(
      <InventoryCostFields
        items={[{ id: 'arrows', name: 'Arrow', quantity: 12 }]}
        value={{ inventoryItemId: 'arrows', quantity: 2 }}
        onChange={onChange}
      />
    );

    expect(
      screen.getByRole('combobox', { name: 'Inventory cost' })
    ).toHaveTextContent('Arrow (12 remaining)');
    fireEvent.change(
      screen.getByRole('textbox', {
        name: 'Inventory quantity consumed per use',
      }),
      { target: { value: '3' } }
    );
    expect(onChange).toHaveBeenCalledWith({
      inventoryItemId: 'arrows',
      quantity: 3,
    });
  });
});
