import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SaveIndicator } from './SaveIndicator';

describe('SaveIndicator', () => {
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
});
