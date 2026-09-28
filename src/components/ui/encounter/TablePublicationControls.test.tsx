import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TablePublicationControls } from './TablePublicationControls';
import type { useTableControl } from '@/hooks/useTableControl';

it('shows a rejected legacy publication instead of hiding the control surface', () => {
  render(
    <TablePublicationControls
      control={
        { status: 'legacy', error: null } as ReturnType<typeof useTableControl>
      }
      combatActive
      publicationError="Publication failed (426)"
      legacyBroadcasting={false}
    />
  );
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Not broadcasting: Publication failed (426)'
  );
});
