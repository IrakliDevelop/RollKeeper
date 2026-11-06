'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/forms/input';
import {
  RadioGroupField,
  RadioGroupItem,
} from '@/components/ui/forms/radio-group';
import { Switch } from '@/components/ui/forms/switch';
import { Section } from '@/components/ui/layout/section';
import { MAX_BANNER_SIZE_MB } from '@/utils/constants';
import {
  isCampaignPageLayout,
  type CampaignPageLayout,
} from '@/types/campaign';
import { BannerImageControls } from './BannerImageControls';

export type NpcSpellSlotMode = 'inline' | 'tracker';

export interface CampaignSettingsSectionProps {
  campaignCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bannerUrl?: string;
  onBannerChange: (url: string | undefined) => void;
  pageLayout: CampaignPageLayout;
  onPageLayoutChange: (layout: CampaignPageLayout) => void;
  stackableInspiration: boolean;
  onStackableInspirationChange: (enabled: boolean) => void;
  customCounterLabel?: string;
  onCustomCounterLabelChange: (label: string | undefined) => void;
  npcSpellSlotMode: NpcSpellSlotMode;
  onNpcSpellSlotModeChange: (mode: NpcSpellSlotMode) => void;
}

/** The player counter label, kept as a local draft and committed on blur/Enter. */
function CounterLabelField({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (label: string | undefined) => void;
}) {
  const [state, setState] = useState({ seen: value, draft: value });
  const focused = useRef(false);
  const changed = useRef(false);
  // A label changed elsewhere replaces the draft unless it is mid-edit.
  if (state.seen !== value) {
    const keepDraft = focused.current && changed.current;
    setState({ seen: value, draft: keepDraft ? state.draft : value });
  }

  const commit = () => {
    if (!changed.current) return;
    changed.current = false;
    const next = state.draft.trim();
    if (next !== value) onCommit(next || undefined);
    setState(current => ({ ...current, draft: next }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      changed.current = false;
      setState(current => ({ ...current, draft: value }));
    }
  };

  return (
    <Input
      label="Player counter"
      helperText="A tally you keep for each player, such as Desperation. Leave it empty to hide the counter."
      placeholder="Desperation"
      className="max-w-xs"
      value={state.draft}
      onChange={event => {
        changed.current = true;
        setState({ seen: value, draft: event.target.value });
      }}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={handleKeyDown}
    />
  );
}

export function CampaignSettingsSection({
  campaignCode,
  open,
  onOpenChange,
  bannerUrl,
  onBannerChange,
  pageLayout,
  onPageLayoutChange,
  stackableInspiration,
  onStackableInspirationChange,
  customCounterLabel,
  onCustomCounterLabelChange,
  npcSpellSlotMode,
  onNpcSpellSlotModeChange,
}: CampaignSettingsSectionProps) {
  return (
    <Section
      heading="Campaign settings"
      level={2}
      collapsed={!open}
      onCollapsedChange={collapsed => onOpenChange(!collapsed)}
    >
      <div className="divide-divider max-w-2xl divide-y">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 lg:flex-col lg:items-stretch">
          <div className="min-w-0">
            <p className="type-ui text-heading">Banner image</p>
            <p className="type-small text-muted">
              {`Shown on this page and on the campaign card. Up to ${MAX_BANNER_SIZE_MB} MB.`}
            </p>
          </div>
          <BannerImageControls
            bannerUrl={bannerUrl}
            campaignCode={campaignCode}
            onBannerChange={onBannerChange}
          />
        </div>
        <div className="py-4">
          <RadioGroupField
            label="Page layout"
            value={pageLayout}
            onValueChange={value => {
              if (isCampaignPageLayout(value)) onPageLayoutChange(value);
            }}
          >
            <RadioGroupItem
              value="standard"
              label="Standard"
              description="The page links in the side column."
            />
            <RadioGroupItem
              value="banner"
              label="Banner"
              description="The banner across the top, between the page links."
            />
            <RadioGroupItem
              value="classic"
              label="Classic"
              description="The original layout, with coloured page tiles."
            />
          </RadioGroupField>
        </div>
        <div className="py-4">
          <Switch
            label="Stackable heroic inspiration"
            description="Players can hold more than one heroic inspiration. When off, they hold at most one."
            checked={stackableInspiration}
            onCheckedChange={onStackableInspirationChange}
          />
        </div>
        <div className="py-4">
          <CounterLabelField
            value={customCounterLabel ?? ''}
            onCommit={onCustomCounterLabelChange}
          />
        </div>
        <div className="pt-4">
          <RadioGroupField
            label="NPC spell slots"
            value={npcSpellSlotMode}
            onValueChange={value => {
              if (value === 'inline' || value === 'tracker') {
                onNpcSpellSlotModeChange(value);
              }
            }}
          >
            <RadioGroupItem value="inline" label="Beside each spell level" />
            <RadioGroupItem value="tracker" label="In a separate tracker" />
          </RadioGroupField>
        </div>
      </div>
    </Section>
  );
}
