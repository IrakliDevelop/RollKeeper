import { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import { MotionConfigContext } from 'framer-motion';
import { describe, expect, it } from 'vitest';

import { MotionProvider } from './MotionProvider';

function ReducedMotionProbe() {
  const { reducedMotion } = useContext(MotionConfigContext);
  return <span>{reducedMotion}</span>;
}

describe('MotionProvider', () => {
  it('makes framer-motion follow the OS reduced-motion setting', () => {
    render(
      <MotionProvider>
        <ReducedMotionProbe />
      </MotionProvider>
    );
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('defaults to never reducing motion without the provider', () => {
    render(<ReducedMotionProbe />);
    expect(screen.getByText('never')).toBeInTheDocument();
  });
});
