import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OtpCodeInputs } from './OtpCodeInputs';

describe('OtpCodeInputs', () => {
  afterEach(cleanup);

  it('spreads a pasted six-digit code and auto-completes', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();

    render(
      <OtpCodeInputs value="" onChange={onChange} onComplete={onComplete} />
    );

    fireEvent.change(screen.getByLabelText('Digit 1 of 6'), {
      target: { value: '424242' },
    });

    expect(onChange).toHaveBeenCalledWith('424242');
    expect(onComplete).toHaveBeenCalledWith('424242');
  });
});
