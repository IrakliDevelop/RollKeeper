import { CharacterState } from './character';

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
}

export interface CampaignInfo {
  code: string;
  name: string;
  createdAt: string;
  customCounterLabel?: string;
  playerCounters?: Record<string, number>; // playerId → counter value
  playerColors?: Record<string, string>; // playerCharacterId → color hex
  bannerUrl?: string; // S3 URL for campaign banner image
  /** DM campaign page: collapsible Players / NPCs sections (persisted in localStorage). */
  dmDashboardUi?: {
    playersSectionOpen?: boolean;
    npcSectionOpen?: boolean;
    /** Group headers under NPC section (when NPCs use groups); names of collapsed groups. */
    npcCollapsedGroupNames?: string[];
    /** Show slot pips inline inside each spell level header in NPC spell tab. */
    npcInlineSpellSlots?: boolean;
    /** Show the separate spell slot tracker block in NPC spell tab. */
    npcSeparateSpellSlotTracker?: boolean;
  };
}
