import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Section } from './section';

describe('Section', () => {
  afterEach(cleanup);

  it('names the region after an h2 heading by default', () => {
    render(
      <Section heading="Hit dice">
        <p>3 of 5 left</p>
      </Section>
    );

    const heading = screen.getByRole('heading', { level: 2, name: 'Hit dice' });
    expect(heading).toHaveClass('type-heading');
    expect(screen.getByRole('region', { name: 'Hit dice' })).toContainElement(
      screen.getByText('3 of 5 left')
    );
  });

  it.each([
    [3, 'type-subheading'],
    [4, 'type-label-heading'],
  ] as const)('renders level %i with %s', (level, typeClass) => {
    render(<Section heading="Saving throws" level={level} />);

    expect(
      screen.getByRole('heading', { level, name: 'Saving throws' })
    ).toHaveClass(typeClass);
  });

  it('puts trailing controls in the heading row', () => {
    render(
      <Section heading="Notes" trailing={<button type="button">Add</button>}>
        <p>None yet</p>
      </Section>
    );

    const row = screen.getByRole('heading', { name: 'Notes' }).parentElement;
    expect(row).toHaveClass('border-b', 'border-divider');
    expect(row).toContainElement(screen.getByRole('button', { name: 'Add' }));
  });

  it('renders a trailing 0 and omits the wrapper without trailing', () => {
    const { rerender } = render(<Section heading="Notes" trailing={0} />);

    const row = screen.getByRole('heading', { name: 'Notes' }).parentElement;
    expect(row).toContainElement(screen.getByText('0'));

    rerender(<Section heading="Notes" />);
    expect(row?.children).toHaveLength(1);
  });

  it('has no box of its own', () => {
    render(<Section heading="Notes" data-testid="section" />);

    const section = screen.getByTestId('section');
    expect(section.className).not.toMatch(/\b(bg-|border|rounded|shadow)/);
  });
});

describe('collapsible Section', () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem('rollkeeper-ui-prefs');
  });
  it('discloses from the heading, persists by key, and keeps trailing controls separate', () => {
    const { unmount } = render(
      <Section
        heading="Spells"
        collapsible="test-spells"
        trailing={<button>Add spell</button>}
      >
        <p>Prepared spells</p>
      </Section>
    );
    const trigger = screen.getByRole('button', { name: 'Spells' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).not.toContainElement(
      screen.getByRole('button', { name: 'Add spell' })
    );
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Prepared spells')).not.toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem('rollkeeper-ui-prefs')!).collapsed[
        'test-spells'
      ]
    ).toBe(true);
    unmount();
    render(
      <Section heading="Spells" collapsible="test-spells">
        <p>Prepared spells</p>
      </Section>
    );
    expect(screen.getByRole('button', { name: 'Spells' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Spells' }));
    expect(screen.getByText('Prepared spells')).toBeVisible();
  });
});

it('does not submit an enclosing form when disclosing its content', () => {
  let submitted = false;
  render(
    <form
      onSubmit={event => {
        event.preventDefault();
        submitted = true;
      }}
    >
      <Section heading="Notes" collapsible="form-notes">
        Session notes
      </Section>
    </form>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Notes' }));
  expect(submitted).toBe(false);
  cleanup();
});
