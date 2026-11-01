import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HPStep from './HPStep';

afterEach(cleanup);

describe('HPStep', () => {
  it('shows retroactive CON hit points as part of the total', () => {
    const props = {
      hitDie: 10,
      constitutionScore: 14,
      hpRollResult: 5,
      hpGained: 10,
      retroactiveHp: 3,
      onRollResultChange: vi.fn(),
    };
    render(<HPStep {...props} />);
    expect(screen.getByText(/Earlier levels.*\+3/)).toBeInTheDocument();
    expect(screen.getByText(/Total HP gained.*\+10/)).toBeInTheDocument();
  });
});
