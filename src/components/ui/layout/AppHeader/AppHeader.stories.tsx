import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, mocked, within } from 'storybook/test';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Switch } from '@/components/ui/forms/switch';
import { SaveIndicator } from '@/components/ui/feedback/SaveIndicator';
import { SyncIndicator } from '@/components/ui/campaign/SyncIndicator';
import { getPublicAuthConfig } from '@/lib/supabase/authConfig';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { useCharacterStore } from '@/store/characterStore';
import {
  emulateCoarsePointer,
  emulateReducedMotion,
} from '@/test/storybook/emulateCoarsePointer';
import { AppHeader } from './index';

function Harness({ campaign = false }: { campaign?: boolean }) {
  return (
    <AppHeader
      sticky
      leading={
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="shrink-0 px-2"
          leftIcon={<ArrowLeft size={20} />}
        >
          <Link href="/player">
            <span className="sr-only sm:not-sr-only">Characters</span>
          </Link>
        </Button>
      }
      title={
        <>
          <h1 className="type-subheading text-heading truncate">Mira Vale</h1>
          <p className="type-small text-body truncate">
            Dwarf Fighter • Level 3
          </p>
        </>
      }
      actions={
        <>
          <Switch
            label="Edit sheet"
            size="sm"
            labelClassName="sr-only sm:not-sr-only"
            wrapperClassName="min-h-6 shrink-0 items-center gap-0 sm:gap-3"
          />
          <SaveIndicator
            status="saved"
            lastSaved={null}
            textClassName="sr-only sm:not-sr-only"
          />
          {campaign && (
            <SyncIndicator
              syncStatus="synced"
              lastSyncedAt={null}
              campaignCode="FAKE01"
              campaignName="Synthetic campaign"
              autoSync
              syncEnabled
              onSyncNow={fn()}
              onToggleAutoSync={fn()}
              onLeaveCampaign={fn()}
              characterData={useCharacterStore.getState().character}
              shareHpWithParty
              onToggleShareHp={fn()}
              sharePartyView={false}
              onSharePartyViewChange={fn()}
            />
          )}
        </>
      }
    />
  );
}
const VIEWPORTS = {
  phone: { name: 'Phone', styles: { width: '390px', height: '844px' } },
  portrait: { name: 'Portrait', styles: { width: '820px', height: '1180px' } },
  landscape: {
    name: 'Landscape',
    styles: { width: '1180px', height: '820px' },
  },
};
const meta: Meta<typeof Harness> = {
  title: 'Layout/AppHeader',
  component: Harness,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true },
    viewport: { options: VIEWPORTS },
    a11y: { test: 'error' },
  },
  beforeEach: ({ parameters }) => {
    mocked(getPublicAuthConfig).mockReturnValue({
      url: 'http://auth-fake.localhost',
      publishableKey: 'synthetic-key',
    });
    const session = parameters.signedIn
      ? ({ user: { email: 'mira@example.invalid' } } as Session)
      : null;
    mocked(createSupabaseBrowserClient).mockReturnValue({
      auth: {
        onAuthStateChange: (
          callback: (event: AuthChangeEvent, session: Session | null) => void
        ) => {
          callback('INITIAL_SESSION', session);
          return { data: { subscription: { unsubscribe: fn() } } };
        },
      },
    } as unknown as ReturnType<typeof createSupabaseBrowserClient>);
  },
  play: async ({ canvasElement, parameters }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', {
      name: parameters.signedIn
        ? 'Account menu for mira@example.invalid'
        : 'Sign in',
    });
    const bar = canvas.getByRole('banner');
    await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
    // On fine pointers, the switch's label provides its clickable 24px row.
    for (const control of bar.querySelectorAll('button, a')) {
      const target =
        control.getAttribute('role') === 'switch'
          ? control.closest('label')!
          : control;
      const rect = target.getBoundingClientRect();
      await expect(rect.height).toBeGreaterThanOrEqual(24);
      await expect(rect.width).toBeGreaterThanOrEqual(24);
    }
    const restore = emulateCoarsePointer();
    try {
      for (const control of bar.querySelectorAll('button, a')) {
        const rect = control.getBoundingClientRect();
        const hit =
          control.getAttribute('role') === 'switch'
            ? getComputedStyle(control, '::after')
            : null;
        await expect(
          hit ? parseFloat(hit.height) : rect.height
        ).toBeGreaterThanOrEqual(44);
        await expect(
          hit ? parseFloat(hit.width) : rect.width
        ).toBeGreaterThanOrEqual(44);
      }
    } finally {
      restore();
    }
    const restoreMotion = emulateReducedMotion();
    try {
      for (const control of bar.querySelectorAll('button, a')) {
        const durations = getComputedStyle(control)
          .transitionDuration.split(',')
          .map(value => parseFloat(value));
        await expect(Math.max(...durations)).toBeLessThanOrEqual(0.001);
      }
    } finally {
      restoreMotion();
    }
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const SignedOutPhone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const SignedInPhone: Story = {
  ...SignedOutPhone,
  parameters: { signedIn: true },
};
export const CampaignPhone: Story = {
  ...SignedOutPhone,
  args: { campaign: true },
};
export const CampaignPhoneDark: Story = {
  ...CampaignPhone,
  globals: { ...SignedOutPhone.globals, theme: 'dark' },
};
export const SignedInPhoneDark: Story = {
  ...SignedInPhone,
  globals: { ...SignedOutPhone.globals, theme: 'dark' },
};
export const SignedOutPhoneDark: Story = {
  ...SignedOutPhone,
  globals: { ...SignedOutPhone.globals, theme: 'dark' },
};
export const Portrait: Story = {
  args: { campaign: true },
  globals: { viewport: { value: 'portrait', isRotated: false } },
};
export const PortraitDark: Story = {
  ...Portrait,
  globals: { ...Portrait.globals, theme: 'dark' },
};
export const Landscape: Story = {
  args: { campaign: true },
  parameters: { signedIn: true },
  globals: { viewport: { value: 'landscape', isRotated: false } },
};
export const LandscapeDark: Story = {
  ...Landscape,
  globals: { ...Landscape.globals, theme: 'dark' },
};
