import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

import { CastingBanner } from '@/components/ui/campaign/player-vtt/CastingBanner';
import type { SpellAoe } from '@/types/spellAoe';

describe('CastingBanner', () => {
  afterEach(() => cleanup());

  it('shows the tap-to-place instruction for a circle spell', () => {
    const aoe: SpellAoe = { shape: 'circle', sizeFeet: 20 };
    render(<CastingBanner spellName="Fireball" aoe={aoe} onCancel={vi.fn()} />);

    expect(
      screen.getByText('Tap the map to place the template')
    ).toBeInTheDocument();
  });

  it('shows the tap-then-drag aim instruction for a cone spell', () => {
    const aoe: SpellAoe = { shape: 'cone', sizeFeet: 15 };
    render(
      <CastingBanner spellName="Burning Hands" aoe={aoe} onCancel={vi.fn()} />
    );

    expect(
      screen.getByText('Tap the map, then drag to aim')
    ).toBeInTheDocument();
  });

  it('shows the tap-then-drag aim instruction for a line spell', () => {
    const aoe: SpellAoe = { shape: 'line', sizeFeet: 60, widthFeet: 5 };
    render(
      <CastingBanner spellName="Lightning Bolt" aoe={aoe} onCancel={vi.fn()} />
    );

    expect(
      screen.getByText('Tap the map, then drag to aim')
    ).toBeInTheDocument();
  });

  it('shows the tap-to-place instruction for a square spell', () => {
    const aoe: SpellAoe = { shape: 'square', sizeFeet: 15 };
    render(
      <CastingBanner spellName="Storm Sphere" aoe={aoe} onCancel={vi.fn()} />
    );

    expect(
      screen.getByText('Tap the map to place the template')
    ).toBeInTheDocument();
  });

  it('names the spell, size and shape in one line', () => {
    const aoe: SpellAoe = { shape: 'circle', sizeFeet: 20 };
    render(<CastingBanner spellName="Fireball" aoe={aoe} onCancel={vi.fn()} />);

    expect(
      screen.getByText('Placing Fireball · 20 ft circle')
    ).toBeInTheDocument();
    expect(screen.queryByText(/tap the map to drop/)).not.toBeInTheDocument();
  });

  it('cancels with a ghost button', () => {
    const onCancel = vi.fn();
    const aoe: SpellAoe = { shape: 'circle', sizeFeet: 20 };
    render(
      <CastingBanner spellName="Fireball" aoe={aoe} onCancel={onCancel} />
    );

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel).toHaveAttribute('data-variant', 'ghost');
    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
