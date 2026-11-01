import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  afterEach(cleanup);

  it('fills brass with an on-brass mark when checked', () => {
    render(<Checkbox aria-label="Proficient" checked />);

    const box = screen.getByRole('checkbox', { name: 'Proficient' });
    expect(box).toHaveAttribute('data-state', 'checked');
    expect(box).toHaveClass(
      'border-input-border',
      'data-[state=checked]:bg-brass-fill',
      'data-[state=checked]:border-brass-fill'
    );
    expect(box.querySelector('.text-on-brass')).not.toBeNull();
  });

  it('drops the glow overlay and the hover shadow', () => {
    render(<Checkbox aria-label="Proficient" checked />);

    const box = screen.getByRole('checkbox', { name: 'Proficient' });
    expect(box.querySelector('.bg-white')).toBeNull();
    expect(box.className).not.toMatch(/shadow|overflow-hidden/);
  });

  it('treats every variant as brass', () => {
    render(
      <>
        <Checkbox aria-label="Primary" variant="primary" />
        <Checkbox aria-label="Success" variant="success" />
        <Checkbox aria-label="Warning" variant="warning" />
        <Checkbox aria-label="Danger" variant="danger" />
        <Checkbox aria-label="Default" variant="default" />
      </>
    );

    const base = screen.getByRole('checkbox', { name: 'Primary' }).className;
    for (const name of ['Success', 'Warning', 'Danger', 'Default']) {
      expect(screen.getByRole('checkbox', { name }).className).toBe(base);
    }
  });

  it('fills brass when indeterminate', () => {
    render(<Checkbox aria-label="Some prepared" checked="indeterminate" />);

    const box = screen.getByRole('checkbox', { name: 'Some prepared' });
    expect(box).toHaveAttribute('data-state', 'indeterminate');
    expect(box).toHaveClass('data-[state=indeterminate]:bg-brass-fill');
  });

  it('keeps its visual size and grows its hit area to 44px on coarse pointers', () => {
    render(<Checkbox aria-label="Proficient" size="sm" />);

    const box = screen.getByRole('checkbox', { name: 'Proficient' });
    expect(box).toHaveClass(
      'h-4',
      'w-4',
      'relative',
      'pointer-coarse:after:size-11'
    );
    expect(box.className).not.toMatch(/pointer-coarse:(min-)?[hw]-/);
  });

  it('names and describes the box from its label text', () => {
    render(
      <Checkbox label="Prepared" description="Counts against your limit" />
    );

    const box = screen.getByRole('checkbox', { name: 'Prepared' });
    expect(box).toHaveAccessibleDescription('Counts against your limit');
  });

  it('keeps a caller aria-label as the name', () => {
    render(<Checkbox label="Prepared" aria-label="Prepare Fireball" />);

    expect(
      screen.getByRole('checkbox', { name: 'Prepare Fireball' })
    ).not.toHaveAttribute('aria-labelledby');
  });

  it('makes a labelled row 44px on coarse pointers, but not a bare box', () => {
    render(
      <>
        <Checkbox label="Stealth" />
        <Checkbox aria-label="Proficient" />
      </>
    );

    const labelledRow = screen.getByRole('checkbox', {
      name: 'Stealth',
    }).parentElement;
    const bareRow = screen.getByRole('checkbox', {
      name: 'Proficient',
    }).parentElement;
    expect(labelledRow).toHaveClass(
      'pointer-coarse:min-h-11',
      'pointer-coarse:items-center'
    );
    expect(bareRow?.className).not.toMatch(/pointer-coarse:min-h-11/);
  });

  it('keeps a described box beside its label on coarse pointers', () => {
    render(<Checkbox label="Wizard" description="Prepares from a spellbook" />);

    const row = screen.getByRole('checkbox', { name: 'Wizard' }).parentElement;
    expect(row).toHaveClass('pointer-coarse:min-h-11', 'pointer-coarse:pt-3');
    expect(row?.className).not.toMatch(/pointer-coarse:items-center/);
  });

  it('uses the brass focus outline', () => {
    render(<Checkbox aria-label="Proficient" />);

    expect(screen.getByRole('checkbox')).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-ring'
    );
  });
});
