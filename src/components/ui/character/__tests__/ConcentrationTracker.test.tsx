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
});
