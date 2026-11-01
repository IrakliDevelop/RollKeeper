import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor, within } from 'storybook/test';
import globalsCss from '@/app/globals.css?raw';
import { remountOnTheme } from './remountOnTheme';
import { readThemeColours } from './themeTokens';
import { useComputedValue } from './useComputedValue';

/**
 * Every colour token, in paper and felt side by side. Names and notes come
 * from globals.css and each value is read from the browser, so the page
 * can't fall out of step with the app. `npm run design:contrast` checks the
 * pairings in CI.
 */
const meta: Meta = {
  title: 'Foundations/Colour',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const COLOURS = readThemeColours(globalsCss);

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
  { theme: 'blue', label: 'Blue dark' },
] as const;

function Swatch({ token, note }: { token: string; note?: string | null }) {
  const { ref, value } = useComputedValue<HTMLSpanElement>(token);
  return (
    <li className="flex items-start gap-3">
      <span
        ref={ref}
        aria-hidden
        className="border-divider mt-0.5 h-8 w-8 shrink-0 rounded-sm border"
        style={{ background: `var(${token})` }}
      />
      <div className="min-w-0">
        <code className="type-small text-heading">{token}</code>
        <p className="type-caption text-muted">
          <span data-token-value={token}>{value}</span>
          {note ? ` · ${note}` : ''}
        </p>
      </div>
    </li>
  );
}

function ThemePanel({ theme, label }: (typeof THEMES)[number]) {
  const scheme = useComputedValue<HTMLDivElement>('color-scheme');
  return (
    <div
      ref={scheme.ref}
      data-theme={theme}
      className="bg-background border-divider space-y-6 rounded-md border p-4"
    >
      <div>
        <h2 className="type-heading text-heading">{label}</h2>
        <p className="type-caption text-muted">
          Native controls and scrollbars: color-scheme{' '}
          <span data-color-scheme>{scheme.value}</span>
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="type-subheading text-heading border-divider border-b pb-2">
          Neutrals
        </h3>
        <p className="type-small text-body">
          Page canvas, cards, floating layers, text and rules.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {COLOURS.neutrals.map(({ name, note }) => (
            <Swatch key={name} token={name} note={note} />
          ))}
        </ul>
        <ul className="type-caption text-muted space-y-1">
          {COLOURS.aliases.map(({ name, target }) => (
            <li key={name}>
              <code className="text-heading">{name}</code> is{' '}
              <code className="text-heading">{target}</code>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="type-subheading text-heading border-divider border-b pb-2">
          Roles
        </h3>
        <p className="type-small text-body">
          Each colour has one job. Use it only for that job, and back it up with
          text or shape.
        </p>
        {COLOURS.roles.map(({ role, job, tokens }) => (
          <div key={role} className="space-y-2">
            <h4 className="type-label-heading text-heading">
              {role}
              <span className="type-small text-body font-normal"> · {job}</span>
            </h4>
            <ul className="grid gap-3 sm:grid-cols-2">
              {tokens.map(token => (
                <Swatch key={token} token={token} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColourPage() {
  return (
    <div className="space-y-4">
      <p className="type-body text-body max-w-prose">
        The hue-named <code>accent-*</code> tokens and the{' '}
        <code>--gradient-*</code> variables are deprecated: existing uses only,
        never new ones.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        {THEMES.map(panel => (
          <ThemePanel key={panel.theme} {...panel} />
        ))}
      </div>
    </div>
  );
}

async function checkColours(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const count =
    COLOURS.neutrals.length +
    COLOURS.roles.reduce((sum, r) => sum + r.tokens.length, 0);
  const values: Record<string, Record<string, string>> = {};

  for (const { theme, label } of THEMES) {
    const panel = canvas
      .getByRole('heading', { name: label })
      .closest<HTMLElement>('[data-theme]')!;
    const rows = Array.from(
      panel.querySelectorAll<HTMLElement>('[data-token-value]')
    );
    // Every token in globals.css is on the page and resolves to a value.
    await expect(rows).toHaveLength(count);
    for (const row of rows) {
      await waitFor(() => expect(row.textContent).not.toBe(''));
    }
    values[label] = Object.fromEntries(
      rows.map(row => [row.dataset.tokenValue!, row.textContent!])
    );
    const scheme = panel.querySelector('[data-color-scheme]')!;
    await waitFor(() =>
      expect(scheme.textContent).toBe(theme === 'light' ? 'light' : 'dark')
    );
  }
  // Each panel reads its own theme.
  await expect(values['Felt (dark)']['--surface']).not.toBe(
    values['Paper (light)']['--surface']
  );
  await expect(values['Felt (dark)']['--brass-text']).not.toBe(
    values['Paper (light)']['--brass-text']
  );
}

export const Colour: Story = {
  render: () => <ColourPage />,
  play: async ({ canvasElement }) => checkColours(canvasElement),
};

/** The same page inside a felt document, as the toolbar's Dark shows it. */
export const ColourInFelt: Story = {
  render: () => <ColourPage />,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => checkColours(canvasElement),
};
