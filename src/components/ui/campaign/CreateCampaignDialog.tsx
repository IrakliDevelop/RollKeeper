'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/feedback/dialog-new';
import { Badge } from '@/components/ui/layout/badge';

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: (code: string, name: string) => void;
  dmId: string;
}

export function CreateCampaignDialog({
  open,
  onOpenChange,
  onCampaignCreated,
  dmId,
}: CreateCampaignDialogProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dmId, campaignName: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create campaign');
      }

      const data = await res.json();
      setCreatedCode(data.code);
      setStep('success');
      onCampaignCreated(data.code, name.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create campaign'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setStep('form');
    setName('');
    setError('');
    setCreatedCode('');
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>
                Give your campaign a name. A unique join code will be generated
                for your players.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Input
                label="Campaign Name"
                placeholder="e.g. Curse of Strahd"
                value={name}
                onChange={e => setName(e.target.value)}
                error={error}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Campaign Created!</DialogTitle>
              <DialogDescription>
                Share this code with your players so they can sync their
                characters.
              </DialogDescription>
            </DialogHeader>

            <div className="py-6 text-center">
              <p className="text-muted mb-3 text-sm">Campaign Code</p>
              <div className="mb-4 flex items-center justify-center gap-3">
                <Badge
                  variant="info"
                  size="lg"
                  className="px-6 py-3 font-mono text-2xl tracking-widest"
                >
                  {createdCode}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyCode}
                  aria-label="Copy campaign code"
                >
                  {copied ? (
                    <Check size={16} className="text-green-500" />
                  ) : (
                    <Copy size={16} />
                  )}
                </Button>
              </div>
              <p className="text-body text-sm">
                Players can enter this code from their character sheet or
                dashboard to join.
              </p>
            </div>

            <DialogFooter>
              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
