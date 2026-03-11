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
}
