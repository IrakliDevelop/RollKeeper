import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { expect, fn, mocked, within } from 'storybook/test';
import { Button } from '@/components/ui/forms/button';
import { getPublicAuthConfig } from '@/lib/supabase/authConfig';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { CampaignHeader } from './CampaignHeader';
import { CopyCodeButton } from './CopyCodeButton';

const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};

const meta: Meta<typeof CampaignHeader> = {
  title: 'Campaign/CampaignHeader',
  component: CampaignHeader,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  beforeEach: () => {
    mocked(getPublicAuthConfig).mockReturnValue({
      url: 'http://auth-fake.localhost',
      publishableKey: 'synthetic-key',
    });
    mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        onAuthStateChange: (
          callback: (event: AuthChangeEvent, session: Session | null) => void
        ) => {
          callback('INITIAL_SESSION', null);
          return { data: { subscription: { unsubscribe: fn() } } };
        },
      },
    } as unknown as ReturnType<typeof createSupabaseBrowserClient>);
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const WithCrumb: Story = {
  args: {
    crumb: { href: '/dm', label: 'Campaigns' },
    title: <h1 className="type-heading text-heading">The Sunken Bell</h1>,
  },
};

export const NoCrumb: Story = {
  args: {
    title: <h1 className="type-heading text-heading">Encounter</h1>,
  },
};

export const LongTitle: Story = {
  args: {
    crumb: { href: '/dm', label: 'Campaigns' },
    wrapControls: true,
    title: (
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="type-heading text-heading truncate">
          The Sunken Bell of the Drowned Kingdom of Vael Therunis and the Seven
          Tides
        </h1>
        <CopyCodeButton code="P3HZ9R" className="shrink-0" />
      </div>
    ),
    actions: (
      <>
        <Button size="sm">Locations</Button>
        <Button size="sm">Calendar</Button>
        <Button size="sm">Encounters</Button>
        <Button size="sm">Battle maps</Button>
      </>
    ),
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: 'Sign in' });
    const bar = canvas.getByRole('banner');
    await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
  },
};
