import { cleanup, render, screen } from '@testing-library/react';
import { ArrowRight } from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  afterEach(cleanup);

  it('makes an asChild link with an icon the full button element', () => {
    const { container } = render(
      <Button asChild rightIcon={<ArrowRight data-testid="arrow" />}>
        <a href="/player">Start as Player</a>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Start as Player' });

    expect(link).toHaveAttribute('href', '/player');
    expect(link).toHaveClass('cursor-pointer', 'h-10', 'px-5');
    expect(container.firstElementChild).toBe(link);
    expect(link).toContainElement(screen.getByTestId('arrow'));
  });

  it('defaults to the secondary variant', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
  });

  it('exposes the variant it was given', () => {
    render(<Button variant="danger-solid">Delete</Button>);

    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveAttribute('data-variant', 'danger-solid');
    expect(button).toHaveClass('bg-blood-fill', 'text-on-blood');
  });

  it('treats success and warning as outlines', () => {
    render(
      <>
        <Button variant="success">Equip</Button>
        <Button variant="warning">Hide</Button>
        <Button variant="secondary">Open</Button>
      </>
    );

    const classOf = (name: string) =>
      screen.getByRole('button', { name }).className;
    expect(classOf('Equip')).toBe(classOf('Open'));
    expect(classOf('Hide')).toBe(classOf('Open'));
  });

  it('marks a selected toggle without touching aria-pressed', () => {
    render(
      <>
        <Button variant="outline" selected>
          Equipped
        </Button>
        <Button variant="outline">Equip</Button>
      </>
    );

    const on = screen.getByRole('button', { name: 'Equipped' });
    const off = screen.getByRole('button', { name: 'Equip' });
    expect(on).toHaveAttribute('data-selected', 'true');
    expect(on).toHaveClass('border-brass-border', 'text-brass-text');
    expect(on).not.toHaveAttribute('aria-pressed');
    expect(off).not.toHaveAttribute('data-selected');
    expect(off).not.toHaveClass('text-brass-text');
  });

  it('leaves a filled variant alone when selected', () => {
    render(
      <Button variant="primary" selected aria-pressed>
        Rectangle
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Rectangle' });
    expect(button).toHaveClass('bg-brass-fill', 'text-on-brass');
    expect(button).not.toHaveClass('text-brass-text');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('reaches 44px on coarse pointers', () => {
    render(
      <Button size="xs" aria-label="Close">
        ×
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(
      'pointer-coarse:min-h-11',
      'pointer-coarse:min-w-11'
    );
  });
});
