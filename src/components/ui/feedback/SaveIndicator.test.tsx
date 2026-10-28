import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SaveIndicator } from './SaveIndicator';

describe('SaveIndicator', () => {
  afterEach(cleanup);

  it('labels an acknowledged IndexedDB write as locally saved', () => {
    render(<SaveIndicator status="saved-local" />);

    expect(screen.getByText('Local: saved')).toBeInTheDocument();
  });

  it('surfaces a pending compatibility-mirror retry without denying the IndexedDB save', () => {
    render(<SaveIndicator status="saved-local-mirror-pending" />);

    expect(
      screen.getByText('Local: saved · compatibility mirror retry pending')
    ).toBeInTheDocument();
  });

  it('puts textClassName on the status text only', () => {
    render(
      <SaveIndicator status="saved" textClassName="sr-only sm:not-sr-only" />
    );
    expect(screen.getByText('All changes saved')).toHaveClass('sr-only');
    cleanup();
    render(
      <SaveIndicator
        status="saved"
        lastSaved={new Date()}
        textClassName="sr-only sm:not-sr-only"
      />
    );
    expect(screen.getByText('• just now')).toHaveClass('sr-only');
    cleanup();
    render(<SaveIndicator status="saved" />);
    expect(screen.getByText('All changes saved')).not.toHaveClass('sr-only');
  });
});
