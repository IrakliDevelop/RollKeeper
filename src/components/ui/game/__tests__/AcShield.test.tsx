import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { AcShield } from '../AcShield';

afterEach(cleanup);

describe('AcShield', () => {
  it('shows the number and hides the outline from screen readers', () => {
    const { container } = render(<AcShield value={16} />);
    const shield = container.querySelector('[data-ac-shield]')!;
    expect(shield).toHaveTextContent(/^16$/);
    expect(shield.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('reads as the number alone, so the caption can say AC', () => {
    const { container } = render(
      <figure>
        <AcShield value={9} />
        <figcaption>AC</figcaption>
      </figure>
    );
    expect(container).toHaveTextContent(/^9AC$/);
  });
});
