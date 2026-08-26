import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BannerUpload } from './BannerUpload';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // `fill` and `priority` are next/image-only props that are not valid
    // native <img> attributes; drop them without naming (and then not
    // using) them as locals. `next/image`'s own `alt` is always forwarded
    // through `rest`, satisfying accessibility -- this is a test-only stub
    // standing in for the real, optimized component.
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

/**
 * Task 18 fix round 2, item 1 (coordinator review): `/dm`'s dashboard
 * hardening (spec R2b) rests its "the card variant is display-only"
 * argument on `BannerUpload.tsx:104-134` rendering no edit controls -- that
 * premise was previously verified only by reading the file, never asserted.
 * `BannerUpload` is now `vi.mock`ed in the only file that rendered it
 * (`src/app/dm/__tests__/page.test.tsx`), so nothing else exercises the
 * real component. These tests pin the premise directly against the real
 * component: if an edit control is ever added to the card variant, this is
 * what should fail and point back at the dashboard's callback-swap
 * hardening.
 */
describe('BannerUpload — variant="card" is display-only', () => {
  afterEach(() => {
    cleanup();
  });

  it('exposes no file input and no button when a banner is set', () => {
    const onBannerChange = vi.fn();
    const { container } = render(
      <BannerUpload
        campaignCode="ALPHA"
        bannerUrl="https://example.test/banner.png"
        onBannerChange={onBannerChange}
        variant="card"
      />
    );

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(onBannerChange).not.toHaveBeenCalled();
  });

  it('exposes no file input and no button in the empty-banner placeholder state', () => {
    const onBannerChange = vi.fn();
    const { container } = render(
      <BannerUpload
        campaignCode="ALPHA"
        onBannerChange={onBannerChange}
        variant="card"
      />
    );

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(onBannerChange).not.toHaveBeenCalled();
  });

  it('exposes no file input and no button even when editable is explicitly true (card variant ignores editable)', () => {
    const onBannerChange = vi.fn();
    const { container } = render(
      <BannerUpload
        campaignCode="ALPHA"
        bannerUrl="https://example.test/banner.png"
        onBannerChange={onBannerChange}
        variant="card"
        editable
      />
    );

    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
