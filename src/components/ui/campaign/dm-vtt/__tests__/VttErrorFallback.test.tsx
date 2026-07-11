import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { VttErrorFallback } from '@/components/ui/campaign/dm-vtt/VttErrorFallback';

describe('VttErrorFallback', () => {
  afterEach(() => cleanup());

  it('renders the error message and a reload button', () => {
    render(<VttErrorFallback />);
    expect(
      screen.getByText(/the battle map hit an error/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reload map/i })
    ).toBeInTheDocument();
  });
});
