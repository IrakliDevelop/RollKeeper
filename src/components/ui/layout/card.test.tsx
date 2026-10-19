import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Card } from './card';

describe('Card', () => {
  afterEach(cleanup);

  it('draws a 6px object box with a 1px divider and no shadow', () => {
    render(<Card data-testid="card">Goblin</Card>);

    const card = screen.getByTestId('card');
    expect(card).toHaveClass('rounded-md', 'border', 'border-divider');
    expect(card.className).not.toMatch(/shadow/);
  });

  it('treats bordered as the default box', () => {
    render(
      <>
        <Card data-testid="default">Goblin</Card>
        <Card data-testid="bordered" variant="bordered">
          Orc
        </Card>
      </>
    );

    expect(screen.getByTestId('bordered').className).toBe(
      screen.getByTestId('default').className
    );
  });

  it('swaps the hover shadow for an input-border edge when interactive', () => {
    render(<Card onClick={() => {}}>Fireball</Card>);

    const card = screen.getByRole('button', { name: 'Fireball' });
    expect(card).toHaveClass('hover:border-input-border', 'border');
    expect(card.className).not.toMatch(/shadow/);
  });

  it.each(['Enter', ' '])('activates on %j like a button', key => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Fireball</Card>);

    fireEvent.keyDown(screen.getByRole('button', { name: 'Fireball' }), {
      key,
    });

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('leaves keys pressed on a nested button to that button', () => {
    const onCardClick = vi.fn();
    render(
      <Card onClick={onCardClick}>
        Fireball
        <button type="button">Prepare</button>
      </Card>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Prepare' }), {
      key: 'Enter',
    });

    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('ignores other keys and keeps a caller onKeyDown', () => {
    const onClick = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <Card onClick={onClick} onKeyDown={onKeyDown}>
        Fireball
      </Card>
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Fireball' }), {
      key: 'a',
    });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stays a plain box without onClick or interactive', () => {
    render(<Card data-testid="card">Goblin</Card>);

    const card = screen.getByTestId('card');
    expect(card).not.toHaveAttribute('role');
    expect(card).not.toHaveAttribute('tabindex');
  });
});
