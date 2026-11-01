import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Switch } from './switch';

describe('Switch', () => {
  afterEach(cleanup);

  it('colours the track from data-state, so an uncontrolled switch turns brass', () => {
    render(<Switch aria-label="Concentrating" />);

    const toggle = screen.getByRole('switch', { name: 'Concentrating' });
    const before = toggle.className;
    expect(toggle).toHaveAttribute('data-state', 'unchecked');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('data-state', 'checked');
    expect(toggle.className).toBe(before);
    expect(toggle).toHaveClass(
      'data-[state=unchecked]:bg-input-border',
      'data-[state=checked]:bg-brass-fill'
    );
  });

  it('treats every variant as brass', () => {
    render(
      <>
        <Switch aria-label="Default" />
        <Switch aria-label="Success" variant="success" />
        <Switch aria-label="Danger" variant="danger" />
      </>
    );

    const base = screen.getByRole('switch', { name: 'Default' }).className;
    expect(screen.getByRole('switch', { name: 'Success' }).className).toBe(
      base
    );
    expect(screen.getByRole('switch', { name: 'Danger' }).className).toBe(base);
  });

  it('draws an on-brass thumb with no shadow', () => {
    render(<Switch aria-label="Inspired" defaultChecked />);

    const thumb = screen.getByRole('switch').querySelector('span');
    expect(thumb).toHaveClass('bg-on-brass');
    expect(thumb?.className).not.toMatch(/shadow|bg-white/);
  });

  it('uses the brass focus outline instead of a white ring offset', () => {
    render(<Switch aria-label="Inspired" />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-ring'
    );
    expect(toggle.className).not.toMatch(/ring-offset|emerald/);
  });

  it('names the switch from its label and describes it separately', () => {
    render(<Switch label="Concentrating" description="Shown on the tracker" />);

    const toggle = screen.getByRole('switch', { name: 'Concentrating' });
    expect(toggle).toHaveAccessibleDescription('Shown on the tracker');
  });

  it('makes a labelled row 44px and centres the switch on coarse pointers', () => {
    render(<Switch label="Concentrating" />);

    expect(screen.getByText('Concentrating').closest('label')).toHaveClass(
      'pointer-coarse:min-h-11',
      'pointer-coarse:items-center'
    );
  });

  it('keeps a described switch beside its label on coarse pointers', () => {
    render(<Switch label="Concentrating" description="Shown on the tracker" />);

    const row = screen.getByText('Concentrating').closest('label');
    expect(row).toHaveClass('pointer-coarse:min-h-11', 'pointer-coarse:pt-3');
    expect(row?.className).not.toMatch(/pointer-coarse:items-center/);
  });

  it('grows its hit area to 44px on coarse pointers', () => {
    render(<Switch aria-label="Inspired" />);

    expect(screen.getByRole('switch')).toHaveClass(
      'relative',
      'pointer-coarse:after:h-11',
      'pointer-coarse:after:w-[max(100%,2.75rem)]'
    );
  });

  it('puts labelClassName on the label text and keeps the name', () => {
    render(
      <Switch label="Edit sheet" labelClassName="sr-only sm:not-sr-only" />
    );
    expect(screen.getByText('Edit sheet')).toHaveClass('sr-only');
    expect(
      screen.getByRole('switch', { name: 'Edit sheet' })
    ).toBeInTheDocument();
  });
});
