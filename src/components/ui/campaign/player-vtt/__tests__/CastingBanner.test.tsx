import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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
});
