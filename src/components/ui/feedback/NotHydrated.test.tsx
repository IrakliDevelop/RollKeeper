import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NotHydrated from '@/components/ui/feedback/NotHydrated';

describe('NotHydrated', () => {
  it('shows one loading line as a status', () => {
    const { container } = render(<NotHydrated />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading your character…'
    );
    expect(container).toHaveTextContent(/^Loading your character…$/);
  });
});
