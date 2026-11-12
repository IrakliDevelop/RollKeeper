import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CampaignNav } from './CampaignNav';

describe('CampaignNav', () => {
  afterEach(cleanup);

  it('lists the four campaign pages in order', () => {
    render(<CampaignNav code="K7QX2M" />);
    const nav = screen.getByRole('navigation', { name: 'Campaign pages' });
    const links = within(nav).getAllByRole('link');
    expect(links.map(l => l.textContent)).toEqual([
      'Encounters',
      'Battle maps',
      'Locations',
      'Calendar',
    ]);
    expect(links.map(l => l.getAttribute('href'))).toEqual([
      '/dm/campaign/K7QX2M/encounters',
      '/dm/campaign/K7QX2M/battlemaps',
      '/dm/campaign/K7QX2M/locations',
      '/dm/campaign/K7QX2M/calendar',
    ]);
  });

  it('renders links, not buttons inside links', () => {
    const { container } = render(<CampaignNav code="K7QX2M" />);
    expect(container.querySelector('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Encounters' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
  });

  it('stacks ghost links full width when vertical', () => {
    render(<CampaignNav code="K7QX2M" vertical />);
    const link = screen.getByRole('link', { name: 'Battle maps' });
    expect(link).toHaveAttribute('data-variant', 'ghost');
    expect(link).toHaveClass('w-full', 'justify-start');
  });
});
