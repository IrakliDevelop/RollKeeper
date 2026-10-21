import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useComputedValue } from '../useComputedValue';

afterEach(cleanup);

function Reading({ property }: { property: string }) {
  const { ref, value } = useComputedValue<HTMLDivElement>(property);
  return (
    <div
      ref={ref}
      style={{ borderTopLeftRadius: '6px', ['--surface' as string]: '#e9ebe4' }}
    >
      <output>{value}</output>
    </div>
  );
}

const firstChild = (element: HTMLElement) => element.firstElementChild;

function PickedReading() {
  const { ref, value } = useComputedValue<HTMLDivElement>('padding-top', {
    pick: firstChild,
  });
  return (
    <div ref={ref}>
      <span style={{ paddingTop: '16px' }} />
      <output>{value}</output>
    </div>
  );
}

describe('useComputedValue', () => {
  it('reads a CSS property after mount', () => {
    render(<Reading property="border-top-left-radius" />);
    expect(screen.getByRole('status')).toHaveTextContent('6px');
  });

  it('reads a custom property', () => {
    render(<Reading property="--surface" />);
    expect(screen.getByRole('status')).toHaveTextContent('#e9ebe4');
  });

  it('reads the node that pick returns', () => {
    render(<PickedReading />);
    expect(screen.getByRole('status')).toHaveTextContent('16px');
  });
});
