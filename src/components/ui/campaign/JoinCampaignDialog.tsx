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

type JoinError = {
  field: 'code' | 'character' | 'form';
  message: string;
} | null;

const JOIN_COPY = {
  codeMissing: 'Enter the campaign code.',
  characterMissing: 'Choose a character to join with.',
  codeUnknown: 'No campaign with that code. Check it with your DM.',
  unreachable:
    "Couldn't reach the campaign. Check your connection and try again.",
  characterGone: 'That character is no longer on this device.',
} as const;

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
  const [error, setError] = useState<JoinError>(null);

  const availableCharacters = characters.filter(
    c => !c.isArchived && !c.campaignCode
  );

  const handleJoin = async () => {
    if (loading) return;
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedCode) {
      setError({ field: 'code', message: JOIN_COPY.codeMissing });
      return;
    }
    if (!selectedCharacterId) {
      setError({ field: 'character', message: JOIN_COPY.characterMissing });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaign/${trimmedCode}`);
      if (!res.ok) {
        setError(
          res.status === 404
            ? { field: 'code', message: JOIN_COPY.codeUnknown }
            : { field: 'form', message: JOIN_COPY.unreachable }
        );
        return;
      }

      const data = await res.json();
      const character = characters.find(c => c.id === selectedCharacterId);
      if (!character) {
        setError({ field: 'form', message: JOIN_COPY.characterGone });
        return;
      }

      const joinRes = await fetch(`/api/campaign/${trimmedCode}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rollkeeper-csrf': '1',
        },
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
        setError({
          field: 'form',
          message: joinData.error || JOIN_COPY.unreachable,
        });
        return;
      }

      onJoin(trimmedCode, selectedCharacterId, data.campaign.campaignName);
      handleClose();
    } catch {
      setError({ field: 'form', message: JOIN_COPY.unreachable });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setSelectedCharacterId(preselectedCharacterId || '');
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Join campaign</DialogTitle>
          <DialogDescription>
            Enter the campaign code from your DM to sync your character.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Input
            label="Campaign code"
            placeholder="ABC123"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            error={error?.field === 'code' ? error.message : undefined}
            autoFocus
            className="font-mono"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={e => {
              if (e.key === 'Enter') handleJoin();
            }}
          />

          {!preselectedCharacterId && (
            <SelectField
              label="Character"
              value={selectedCharacterId}
              onValueChange={setSelectedCharacterId}
              error={error?.field === 'character' ? error.message : undefined}
            >
              {availableCharacters.map(char => (
                <SelectItem key={char.id} value={char.id}>
                  {char.name} — {char.class} level {char.level}
                </SelectItem>
              ))}
            </SelectField>
          )}

          {error?.field === 'form' && (
            <p role="alert" className="type-small text-blood-text">
              {error.message}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleJoin} disabled={loading}>
            {loading ? 'Joining…' : 'Join campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
