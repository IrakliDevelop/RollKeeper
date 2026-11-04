'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
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
  const [failed, setFailed] = useState(false);
  // The page clears the recipient as it closes the dialog; keep showing the
  // last one so the title doesn't change while the dialog fades out.
  const [shownTarget, setShownTarget] = useState(targetPlayer);
  if (open && targetPlayer !== shownTarget) setShownTarget(targetPlayer);
  const recipient = open ? targetPlayer : shownTarget;

  const handleSend = async () => {
    if (!title.trim()) return;

    const playerIds = targetPlayer
      ? [targetPlayer.playerId]
      : players.map(p => p.playerId);

    if (playerIds.length === 0) return;

    const message: DmMessage = {
      id: generateMessageId(),
      title: title.trim(),
      content,
      sentAt: new Date().toISOString(),
    };

    setSending(true);
    setFailed(false);

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
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle('');
      setContent('');
      setFailed(false);
      onClose();
    }
  };

  const recipientLabel = recipient
    ? `${recipient.characterName} (${recipient.playerName})`
    : `All players (${players.length})`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {recipient
              ? `Message ${recipient.characterName}`
              : 'Message all players'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <dl className="space-y-1">
            <dt className="type-ui text-heading">To</dt>
            <dd className="type-body text-heading">{recipientLabel}</dd>
          </dl>

          <Input
            label="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="The bridge is out"
            autoFocus
          />

          <div className="space-y-1.5">
            <p className="type-ui text-heading">Message (optional)</p>
            <RichTextEditor
              ariaLabel="Message (optional)"
              content={content}
              onChange={setContent}
              placeholder="Meet at the Rusty Anchor after the session."
              minHeight="120px"
            />
          </div>

          {failed && (
            <p role="alert" className="type-small text-blood-text">
              The message wasn&apos;t sent. Try again.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!title.trim() || sending}
          >
            {sending ? 'Sending…' : 'Send message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
