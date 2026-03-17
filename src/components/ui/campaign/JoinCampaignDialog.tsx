'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { SelectField, SelectItem } from '@/components/ui/forms/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { PlayerCharacter } from '@/store/playerStore';

interface JoinCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characters: PlayerCharacter[];
  onJoin: (code: string, characterId: string, campaignName: string) => void;
  preselectedCharacterId?: string;
}

export function JoinCampaignDialog({
  open,
  onOpenChange,
  characters,
  onJoin,
  preselectedCharacterId,
}: JoinCampaignDialogProps) {
  const [code, setCode] = useState('');
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    preselectedCharacterId || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableCharacters = characters.filter(
    c => !c.isArchived && !c.campaignCode
  );

  const handleJoin = async () => {
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Campaign code is required');
      return;
    }
    if (!selectedCharacterId) {
      setError('Please select a character');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/campaign/${trimmedCode}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Campaign not found. Check the code and try again.');
          return;
        }
        throw new Error('Failed to verify campaign');
      }

      const data = await res.json();
      const character = characters.find(c => c.id === selectedCharacterId);
      if (!character) {
        setError('Character not found');
        return;
      }

      const joinRes = await fetch(`/api/campaign/${trimmedCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: character.id,
          playerName: character.characterData.playerName || character.name,
          characterId: character.id,
          characterName: character.name,
          characterData: character.characterData,
        }),
      });

      if (!joinRes.ok) {
        const joinData = await joinRes.json();
        throw new Error(joinData.error || 'Failed to join campaign');
      }

      onJoin(trimmedCode, selectedCharacterId, data.campaign.campaignName);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join campaign');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setSelectedCharacterId(preselectedCharacterId || '');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Join Campaign</DialogTitle>
          <DialogDescription>
            Enter the campaign code from your DM to sync your character.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Input
            label="Campaign Code"
            placeholder="e.g. ABC123"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            error={error && !selectedCharacterId ? error : undefined}
            autoFocus
            className="font-mono tracking-wider uppercase"
            onKeyDown={e => {
              if (e.key === 'Enter') handleJoin();
            }}
          />

          {!preselectedCharacterId && (
            <SelectField
              label="Character"
              value={selectedCharacterId}
              onValueChange={setSelectedCharacterId}
              error={error && selectedCharacterId ? undefined : undefined}
            >
              {availableCharacters.map(char => (
                <SelectItem key={char.id} value={char.id}>
                  {char.name} — {char.class} Lv.{char.level}
                </SelectItem>
              ))}
            </SelectField>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleJoin} disabled={loading}>
            {loading ? 'Joining...' : 'Join Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
