import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CharacterRecoveryExportControls } from '@/components/ui/feedback/CharacterRecoveryExportControls';

describe('CharacterRecoveryExportControls', () => {
  it('keeps current-generation and immutable-capture downloads available in recovery required', () => {
    render(
      <CharacterRecoveryExportControls namespace="guest" runId="capture" />
    );
    expect(
      screen.getByRole('button', { name: /download current character data/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /download immutable raw capture/i })
    ).toBeInTheDocument();
  });
});
