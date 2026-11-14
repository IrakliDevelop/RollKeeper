import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ErrorBoundary from './ErrorBoundary';
import ErrorPage, { ERROR_PAGE_COPY, type ErrorPageKind } from './ErrorPage';

afterEach(cleanup);

const EXPECTED: Record<
  ErrorPageKind,
  { heading: string; lines: [string, string] }
> = {
  'not-found': {
    heading: 'Page not found',
    lines: ["There's no page at this address.", 'Check the link, or go home.'],
  },
  route: {
    heading: 'This page hit an error',
    lines: [
      "Saved characters and campaigns on this device aren't affected.",
      "Try again. If that doesn't help, go home and open the page from there.",
    ],
  },
  global: {
    heading: 'RollKeeper hit an error',
    lines: [
      "Saved characters and campaigns on this device aren't affected.",
      "Try again reloads RollKeeper. If that doesn't help, go home.",
    ],
  },
};

describe('ErrorPage', () => {
  it.each(['not-found', 'route', 'global'] as const)(
    'shows one heading and both lines for %s',
    kind => {
      render(<ErrorPage kind={kind} onRetry={() => {}} />);
      const headings = screen.getAllByRole('heading');
      expect(headings).toHaveLength(1);
      expect(
        screen.getByRole('heading', { level: 1, name: EXPECTED[kind].heading })
      ).toBeInTheDocument();
      for (const line of EXPECTED[kind].lines) {
        expect(screen.getByText(line)).toBeInTheDocument();
      }
      expect(ERROR_PAGE_COPY[kind].heading).toBe(EXPECTED[kind].heading);
    }
  );

  it('the 404 offers only Home, as the primary link', () => {
    const { container } = render(<ErrorPage kind="not-found" />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toHaveAttribute('href', '/');
    expect(home).toHaveAttribute('data-variant', 'primary');
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      1
    );
  });

  it.each([
    [
      'a route error makes Try again the one primary and calls onRetry once',
      'route',
    ],
    ['a global error has the same two actions', 'global'],
  ] as const)('%s', async (_name, kind) => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { container } = render(<ErrorPage kind={kind} onRetry={onRetry} />);
    const retry = screen.getByRole('button', { name: 'Try again' });
    expect(retry).toHaveAttribute('data-variant', 'primary');
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toHaveAttribute('href', '/');
    expect(home).toHaveAttribute('data-variant', 'secondary');
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      1
    );
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith();
  });

  it('a route page with no onRetry falls back to Home as the primary', () => {
    const { container } = render(<ErrorPage kind="route" />);
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    const home = screen.getByRole('link', { name: 'Home' });
    expect(home).toHaveAttribute('href', '/');
    expect(home).toHaveAttribute('data-variant', 'primary');
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(
      1
    );
  });

  it('shows the error message as plain text', () => {
    render(
      <ErrorPage
        kind="route"
        error={new Error('Spell slots ran out mid-render')}
        onRetry={() => {}}
      />
    );
    expect(
      screen.getByText('Spell slots ran out mid-render')
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Error:/)).toBeNull();
    expect(screen.queryByText(/technical details/i)).toBeNull();
  });

  it('shows no message line for an empty, blank or missing message', () => {
    for (const error of [undefined, new Error(''), new Error('   ')]) {
      const { container, unmount } = render(
        <ErrorPage kind="route" error={error} onRetry={() => {}} />
      );
      expect(container.querySelectorAll('p')).toHaveLength(2);
      expect(screen.queryByText(/unexpected error/i)).toBeNull();
      unmount();
    }
  });

  it('has no joke copy or icons', () => {
    const { container } = render(
      <ErrorPage kind="route" error={new Error('Boom')} onRetry={() => {}} />
    );
    expect(
      screen.queryByText(/natural 1|tavern|saving throws|critical failure/i)
    ).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
});

let shouldThrow = true;

function Thrower() {
  if (shouldThrow) throw new Error('Thrower broke');
  return <p>Recovered</p>;
}

describe('ErrorBoundary default fallback', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    shouldThrow = true;
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shows the route error page and recovers on Try again', async () => {
    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>
    );
    expect(
      screen.getByRole('heading', { name: 'This page hit an error' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      '/'
    );
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('keeps a custom fallback', () => {
    render(
      <ErrorBoundary fallback={<p>Custom fallback</p>}>
        <Thrower />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
