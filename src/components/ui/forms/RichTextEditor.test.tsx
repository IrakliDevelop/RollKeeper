import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RichTextEditor from './RichTextEditor';

afterEach(cleanup);

it('exposes the editor as a multiline textbox', async () => {
  render(
    <RichTextEditor ariaLabel="Note content" content="" onChange={vi.fn()} />
  );
  const editor = await screen.findByRole('textbox', { name: 'Note content' });
  expect(editor).toHaveAttribute('aria-multiline', 'true');
});
