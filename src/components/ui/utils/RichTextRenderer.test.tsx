import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import RichTextRenderer from './RichTextRenderer';

afterEach(() => {
  cleanup();
});

it('renders nothing for empty or whitespace-only content', () => {
  for (const content of ['', '  \n ']) {
    const { container, unmount } = render(
      <RichTextRenderer content={content} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/No content available/)).toBeNull();
    unmount();
  }
});

it('renders stored HTML directly in one root', () => {
  const { container } = render(
    <RichTextRenderer
      content={[
        '<h2>Lore</h2>',
        '<p>See <a href="https://example.com/map">the map</a></p>',
        '<table><tbody>',
        '<tr><th><p>Room</p></th><th><p>DC</p></th></tr>',
        '<tr><td><p>Hall</p></td><td><p>13</p></td></tr>',
        '</tbody></table>',
      ].join('')}
    />
  );
  expect(
    screen.getByRole('heading', { level: 2, name: 'Lore' }).parentElement
  ).toBe(container.firstElementChild);
  expect(screen.getByRole('link', { name: 'the map' })).toHaveAttribute(
    'href',
    'https://example.com/map'
  );
  expect(screen.getAllByRole('columnheader')).toHaveLength(2);
});

it('passes legacy plain text through', () => {
  render(<RichTextRenderer content="Just words" />);
  expect(screen.getByText('Just words')).toBeInTheDocument();
});
