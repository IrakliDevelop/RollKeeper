'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog-new';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import RichTextEditor from '@/components/ui/forms/RichTextEditor';
import type { CampaignPlayerData } from '@/types/campaign';
import type { DmMessage } from '@/types/sharedState';

interface SendMessageDialogProps {
  open: boolean;
  onClose: () => void;
  players: CampaignPlayerData[];
  /** Pre-selected player (when opened from a specific player card) */
  targetPlayer?: CampaignPlayerData | null;
  campaignCode: string;
  dmId: string;
}

function generateMessageId(): string {
  return (
    'msg-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  );
}

export function SendMessageDialog({
  open,
  onClose,
  players,
  targetPlayer,
  campaignCode,
  dmId,
}: SendMessageDialogProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendToAll = !targetPlayer;

  const handleSend = async () => {
    if (!title.trim()) return;

    const playerIds = sendToAll
      ? players.map(p => p.playerId)
      : targetPlayer
        ? [targetPlayer.playerId]
        : [];

    if (playerIds.length === 0) return;

    const message: DmMessage = {
      id: generateMessageId(),
      title: title.trim(),
      content,
      sentAt: new Date().toISOString(),
    };

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaign/${campaignCode}/shared`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'message',
          data: { message, playerIds },
          dmId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }

      setTitle('');
      setContent('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle('');
      setContent('');
      setError(null);
      onClose();
    }
  };

  const recipientLabel = sendToAll
    ? `All players (${players.length})`
    : targetPlayer
      ? `${targetPlayer.characterName} (${targetPlayer.playerName})`
      : 'No recipient';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Message to Player</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {/* Recipient */}
          <div className="space-y-2">
            <label className="text-body text-sm font-medium">To</label>
            <div className="text-heading text-sm">{recipientLabel}</div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-body text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Message title..."
              autoFocus
            />
          </div>

          {/* Content */}
          <div className="space-y-1">
            <label className="text-body text-sm font-medium">
              Message <span className="text-faint font-normal">(optional)</span>
            </label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write your message..."
              minHeight="120px"
            />
          </div>

          {error && <p className="text-accent-red-text text-sm">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!title.trim() || sending}
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
