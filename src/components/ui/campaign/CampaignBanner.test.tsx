import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CampaignBanner } from './CampaignBanner';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // `fill` and `priority` are next/image-only props that are not valid
    // native <img> attributes; drop them before spreading onto the stub.
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

describe('CampaignBanner', () => {
  afterEach(cleanup);

  it('draws the banner as a decorative image', () => {
    const { container } = render(
      <CampaignBanner src="/landing/battle-map.webp" className="aspect-video" />
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', '');
    expect(img).toHaveAttribute('sizes', '(max-width: 1024px) 100vw, 272px');
    expect(img!.parentElement).toHaveClass(
      'relative',
      'overflow-hidden',
      'rounded-md',
      'aspect-video'
    );
  });

  it('renders nothing without a source', () => {
    const { container } = render(<CampaignBanner src="" />);
    expect(container).toBeEmptyDOMElement();
  });
});
