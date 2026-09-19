// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ConditionIconPicker } from '@/components/ui/forms/ConditionIconPicker';
import type { ConditionIconName } from '@/utils/conditionIconRegistry';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Harness({ onPick }: { onPick: (icon: ConditionIconName) => void }) {
  const [icon, setIcon] = useState<ConditionIconName>('skull');
  return (
    <ConditionIconPicker
      value={icon}
      onChange={next => {
        setIcon(next);
        onPick(next);
      }}
    />
  );
}

describe('ConditionIconPicker', () => {
  it('labels the trigger with the current icon and opens a labelled grid', () => {
    render(<Harness onPick={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Condition icon: skull' })
    );
    expect(screen.getByRole('textbox', { name: 'Search icons' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'skull' }).getAttribute('aria-pressed')
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'flame' }).getAttribute('aria-pressed')
    ).toBe('false');
  });

  it('filters by search text (spaces match hyphens) and shows an empty state', () => {
    render(<Harness onPick={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Condition icon: skull' })
    );
    const search = screen.getByRole('textbox', { name: 'Search icons' });

    fireEvent.change(search, { target: { value: 'eye off' } });
    expect(screen.getByRole('button', { name: 'eye-off' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'skull' })).toBeNull();

    fireEvent.change(search, { target: { value: 'zzzz' } });
    expect(screen.getByText('No icons found')).toBeTruthy();
  });

  it('picks an icon, closes the popover and updates the trigger label', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Condition icon: skull' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'droplet' }));

    expect(onPick).toHaveBeenCalledWith('droplet');
    expect(screen.queryByRole('textbox', { name: 'Search icons' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Condition icon: droplet' })
    ).toBeTruthy();
  });
});
