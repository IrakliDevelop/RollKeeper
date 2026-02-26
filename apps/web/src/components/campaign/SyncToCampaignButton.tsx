'use client';

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useCampaignSync } from '@/hooks/useCampaignSync';
import { useCampaignStore, Campaign } from '@/store/campaignStore';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/feedback/dialog-new';
import { Badge } from '@/components/ui/layout/badge';
import { Upload, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface SyncToCampaignButtonProps {
  characterId: string;
  characterData: Record<string, unknown>;
  characterName: string;
}

/**
 * Button that opens a dialog to sync a character to a campaign.
 * Shows campaign list, handles sync, and shows real-time connection status.
 */
export function SyncToCampaignButton({
  characterId,
  characterData,
  characterName,
}: SyncToCampaignButtonProps) {
  const { isAuthenticated } = useAuthContext();
  const { syncing, lastSynced, error, connected, syncCharacter } =
    useCampaignSync();
  const { campaigns, fetchCampaigns } = useCampaignStore();
  const [open, setOpen] = useState(false);
  const [syncedCampaignId, setSyncedCampaignId] = useState<string | null>(null);

  // Fetch campaigns when dialog opens
  useEffect(() => {
    if (open && isAuthenticated) {
      fetchCampaigns();
    }
  }, [open, isAuthenticated, fetchCampaigns]);

  const handleSync = async (campaign: Campaign) => {
    // Strip avatarBase64 to keep snapshot size reasonable
    const { avatarBase64: _avatarBase64, ...cleanData } = characterData;
    const success = await syncCharacter(campaign.id, characterId, cleanData);
    if (success) {
      setSyncedCampaignId(campaign.id);
      setTimeout(() => setSyncedCampaignId(null), 3000);
    }
  };

  if (!isAuthenticated) {
    return null; // Don't show sync button if not logged in
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Sync to a campaign">
          <Upload size={14} className="mr-1.5" />
          Sync to Campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Sync &quot;{characterName}&quot; to Campaign
          </DialogTitle>
          <DialogDescription>
            Choose a campaign to sync your character data to. Your DM will be
            able to see your current stats in real-time.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {/* Connection status */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {connected ? (
              <>
                <Wifi size={12} className="text-green-400" />
                Real-time connection active
              </>
            ) : (
              <>
                <WifiOff size={12} className="text-red-400" />
                Offline — sync will be saved when reconnected
              </>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Campaign list */}
          {campaigns.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No campaigns yet. Ask your DM for an invite code and join from the
              DM dashboard.
            </div>
          ) : (
            campaigns.map(campaign => (
              <div
                key={campaign.id}
                className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 p-3"
              >
                <div>
                  <p className="font-medium text-white">{campaign.name}</p>
                  {campaign.description && (
                    <p className="text-xs text-slate-400">
                      {campaign.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {syncedCampaignId === campaign.id ? (
                    <Badge variant="success" className="gap-1">
                      <Check size={12} />
                      Synced
                    </Badge>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleSync(campaign)}
                      disabled={syncing}
                    >
                      {syncing ? 'Syncing...' : 'Sync'}
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Last synced info */}
          {lastSynced && (
            <p className="text-center text-xs text-slate-500">
              Last synced:{' '}
              {lastSynced.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
