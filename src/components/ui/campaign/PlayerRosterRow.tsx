'use client';
import type { CampaignPlayerData } from '@/types/campaign';
import { PlayerSummaryCard } from './PlayerSummaryCard';
/** The one name for a player's character: heading, labels and confirms. */
export function playerDisplayName(player: CampaignPlayerData): string {
  return player.characterData.name || player.characterName || 'Character';
}

export interface PlayerRosterRowProps {
  player: CampaignPlayerData;
  customCounterLabel?: string;
  counterValue?: number;
  onAdjustCounter?: (delta: number) => void;
  onView: () => void;
  onRemove?: () => void;
}

export function PlayerRosterRow({ onView, ...props }: PlayerRosterRowProps) {
  return (
    <li data-testid={`player-row-${props.player.playerId}`} className="min-w-0">
      <PlayerSummaryCard {...props} onClick={onView} />
    </li>
  );
}
