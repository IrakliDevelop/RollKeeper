import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CampaignBannerHero } from './CampaignBannerHero';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

const onBannerChange = vi.fn();

describe('CampaignBannerHero', () => {
  afterEach(cleanup);

  it('puts Locations and Battle maps before the banner links on the right', () => {
    render(
      <CampaignBannerHero
        code="K7QX2M"
        bannerUrl="/landing/battle-map.webp"
        onBannerChange={onBannerChange}
      />
    );
    const nav = screen.getByRole('navigation', { name: 'Campaign pages' });
    const links = within(nav).getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual([
      'Locations',
      'Battle maps',
      'Calendar',
      'Encounters',
    ]);
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/dm/campaign/K7QX2M/locations',
      '/dm/campaign/K7QX2M/battlemaps',
      '/dm/campaign/K7QX2M/calendar',
      '/dm/campaign/K7QX2M/encounters',
    ]);
  });

  it('draws the banner as a wide decorative image', () => {
    const { container } = render(
      <CampaignBannerHero
        code="K7QX2M"
        bannerUrl="/landing/battle-map.webp"
        onBannerChange={onBannerChange}
      />
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('sizes', '(max-width: 1024px) 100vw, 800px');
    expect(img!.parentElement).toHaveClass('aspect-[16/7]', 'lg:aspect-[16/5]');
    expect(screen.queryByRole('button', { name: 'Add image' })).toBeNull();
  });

  it('offers an upload in the banner slot when there is no banner', () => {
    const { container } = render(
      <CampaignBannerHero code="K7QX2M" onBannerChange={onBannerChange} />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('No banner image yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add image' })
    ).toBeInTheDocument();
  });
});
