import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ConcentrationTracker from '../ConcentrationTracker';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ConcentrationTracker', () => {
  it('uses lapis and keeps the status, rules and end action', () => {
    const onStop = vi.fn();
    const { container } = render(
      <ConcentrationTracker
        concentration={{ isConcentrating: true, spellName: 'Bless', castAt: 2 }}
        onStopConcentration={onStop}
      />
    );
    expect(screen.getByText('Bless')).toBeInTheDocument();
    expect(screen.getByText('Concentration rules')).toBeInTheDocument();
    expect(container.querySelector('.text-lapis-text')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'End concentration' }));
    expect(onStop).toHaveBeenCalledWith();
  });

  it('shows no level line for a concentration cantrip (castAt 0)', () => {
    const { container } = render(
      <ConcentrationTracker
        concentration={{
          isConcentrating: true,
          spellName: 'Guidance',
          castAt: 0,
        }}
        onStopConcentration={vi.fn()}
      />
    );
    expect(screen.getByText('Guidance')).toBeInTheDocument();
    expect(screen.queryByText(/^Level/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Guidance0|\b0\b/);
  });
});
