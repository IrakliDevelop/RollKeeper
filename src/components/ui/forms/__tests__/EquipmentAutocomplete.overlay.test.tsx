// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WeaponAutocomplete } from '../WeaponAutocomplete';
import { ArmorAutocomplete } from '../ArmorAutocomplete';
import { MagicItemAutocomplete } from '../MagicItemAutocomplete';
import { ItemAutocomplete } from '../ItemAutocomplete';
import { AllItemsAutocomplete } from '@/components/ui/campaign/MagicItemLibrary/AllItemsAutocomplete';

afterEach(cleanup);

const OVERLAY_CLASSES = [
  'rounded-md',
  'border-divider',
  'bg-surface-elevated',
  'shadow-overlay',
];

function typeAndFindPopup(query: string, message: string) {
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: query },
  });
  const popup = screen.getByText(message).closest('.absolute');
  expect(popup).not.toBeNull();
  return popup as HTMLElement;
}

describe('inventory autocomplete popups', () => {
  it.each([
    [
      'weapons',
      () => <WeaponAutocomplete items={[]} onSelect={vi.fn()} />,
      'No weapons match “zzz”.',
    ],
    [
      'armor',
      () => <ArmorAutocomplete items={[]} onSelect={vi.fn()} />,
      'No armor matches “zzz”.',
    ],
    [
      'magic items',
      () => <MagicItemAutocomplete items={[]} onSelect={vi.fn()} />,
      'No magic items match “zzz”.',
    ],
    [
      'items',
      () => <ItemAutocomplete items={[]} onSelect={vi.fn()} />,
      'No items match “zzz”.',
    ],
    [
      'compendium',
      () => (
        <AllItemsAutocomplete
          mundaneItems={[]}
          magicItems={[]}
          loading={false}
          onSelect={vi.fn()}
        />
      ),
      'No matching items.',
    ],
  ])('%s results use the shared overlay surface', (_kind, Component, msg) => {
    render(<Component />);
    const popup = typeAndFindPopup('zzz', msg);
    expect(popup).toHaveClass(...OVERLAY_CLASSES);
    expect(popup).not.toHaveClass('rounded-lg');
  });
});
