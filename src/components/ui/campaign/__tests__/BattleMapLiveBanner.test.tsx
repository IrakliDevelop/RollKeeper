import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BattleMapLiveBanner } from '../BattleMapLiveBanner';

describe('BattleMapLiveBanner', () => {
  afterEach(() => cleanup());

  it('shows the live line and a Join map link that fires onJoin', () => {
    const onJoin = vi.fn((event?: unknown) => {
      // Keep jsdom from trying to navigate.
      (
        event as { preventDefault?: () => void } | undefined
      )?.preventDefault?.();
    });
    render(
      <BattleMapLiveBanner
        campaignCode="ABC123"
        battleMapId="map-1"
        mapName="Cellar"
        characterId="hero 1"
        onJoin={onJoin}
      />
    );
    expect(screen.getByText('Battle map “Cellar” is live')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Join map' });
    expect(link).toHaveAttribute(
      'href',
      '/player/campaign/ABC123/battlemap/map-1?character=hero%201'
    );
    expect(link).toHaveAttribute('target', '_blank');
    fireEvent.click(link);
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('compact shows one Open battle map link to the same map', () => {
    render(
      <BattleMapLiveBanner
        compact
        campaignCode="ABC123"
        battleMapId="map-1"
        characterId="hero"
      />
    );
    expect(
      screen.getByRole('link', { name: 'Open battle map' })
    ).toHaveAttribute(
      'href',
      '/player/campaign/ABC123/battlemap/map-1?character=hero'
    );
    expect(screen.queryByText(/is live/)).not.toBeInTheDocument();
  });

  it('without a map name says Battle map is live', () => {
    render(
      <BattleMapLiveBanner
        campaignCode="ABC123"
        battleMapId="map-1"
        characterId="hero"
      />
    );
    expect(screen.getByText('Battle map is live')).toBeInTheDocument();
  });
});
