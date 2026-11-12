import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PeriodIcon } from '../PeriodIcon';

afterEach(cleanup);

describe('PeriodIcon', () => {
  it.each([
    ['Morning', 'lucide-sunrise'],
    ['Afternoon', 'lucide-sun'],
    ['Evening', 'lucide-sunset'],
    ['Night', 'lucide-moon'],
    ['Dusk', 'lucide-clock'],
  ])('%s draws a neutral %s icon', (period, cls) => {
    const { container } = render(<PeriodIcon period={period} />);
    const svg = container.querySelector('svg')!;

    expect(svg).toHaveClass(cls, 'text-muted');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.getAttribute('class')).not.toMatch(/accent-/);
  });
});
