import { CharacterState } from './character';
import type { FogPresetV1 } from './fogMaterial';

export interface CampaignData {
  dmId: string;
  campaignName: string;
  createdAt: string;
}

export interface CampaignPlayerData {
  playerId: string;
  playerName: string;
  characterId: string;
  characterName: string;
  characterData: CharacterState;
  lastSynced: string;
  /** XP after applying queued DM awards to characterData.experience. */
  projectedExperience?: number;
  /** Number of DM XP awards not yet consumed by the player. */
  pendingXpAwardCount?: number;
}

/**
 * DM campaign page layouts: 'standard' (links in the side column), 'banner'
 * (banner across the top between the links) and 'classic' (the page header
 * from before the Felt and Brass redesign).
 */
export const CAMPAIGN_PAGE_LAYOUTS = ['standard', 'banner', 'classic'] as const;
export type CampaignPageLayout = (typeof CAMPAIGN_PAGE_LAYOUTS)[number];

export function isCampaignPageLayout(
  value: unknown
): value is CampaignPageLayout {
  return (CAMPAIGN_PAGE_LAYOUTS as readonly unknown[]).includes(value);
}

export interface CampaignInfo {
  code: string;
  name: string;
  createdAt: string;
  customCounterLabel?: string;
  playerCounters?: Record<string, number>; // playerId → counter value
  playerColors?: Record<string, string>; // playerCharacterId → color hex
  bannerUrl?: string; // S3 URL for campaign banner image
  /** House rule: allow players to stack more than one Heroic Inspiration. Default false. */
  stackableInspiration?: boolean;
  /** Campaign fog preset library. DM-private; never projected to players. Absent when empty. */
  fogPresets?: FogPresetV1[];
  /** DM campaign page: collapsible dashboard sections (persisted in localStorage). */
  dmDashboardUi?: {
    playersSectionOpen?: boolean;
    /** House Rules card on the DM campaign page. Default collapsed. */
    houseRulesSectionOpen?: boolean;
    npcSectionOpen?: boolean;
    monsterSectionOpen?: boolean;
    magicItemLibrarySectionOpen?: boolean;
    /** Group headers under NPC section (when NPCs use groups); names of collapsed groups. */
    npcCollapsedGroupNames?: string[];
    /** Group headers under Custom Monsters section; names of collapsed groups. */
    monsterCollapsedGroupNames?: string[];
    /** Show slot pips inline inside each spell level header in NPC spell tab. */
    npcInlineSpellSlots?: boolean;
    /** Show the separate spell slot tracker block in NPC spell tab. */
    npcSeparateSpellSlotTracker?: boolean;
    /** Campaign page layout. Missing or unknown means 'standard'. */
    pageLayout?: CampaignPageLayout;
  };
}
