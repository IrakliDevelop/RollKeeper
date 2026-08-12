import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkerRichText, sanitizeMarkerRichText } from './MarkerRichText';

describe('MarkerRichText', () => {
  it('keeps compact formatting and renders legacy plain text', () => {
    const { container } = render(
      <MarkerRichText content="Legacy text <strong>bold</strong>" />
    );
    expect(screen.getByText(/Legacy text/)).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('bold');
  });

  it('does not admit scripts, event attributes, links or images', () => {
    const unsafe =
      '<p onclick="alert(1)">Hi</p><script>alert(2)</script><img src=x onerror=alert(3)><a href="javascript:alert(4)">link</a>';
    const safe = sanitizeMarkerRichText(unsafe);
    expect(safe).toContain('&lt;p onclick=');
    const { container } = render(<MarkerRichText content={unsafe} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
  });
});
