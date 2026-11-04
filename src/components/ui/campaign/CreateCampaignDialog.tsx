'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/feedback/dialog';
import { CopyCodeButton } from '@/components/ui/campaign/CopyCodeButton';

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

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Enter a campaign name.');
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

      if (!res.ok) throw new Error('create failed');

      const data = await res.json();
      setCreatedCode(data.code);
      setStep('success');
      onCampaignCreated(data.code, name.trim());
    } catch {
      setError("The campaign wasn't created. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setName('');
    setError('');
    setCreatedCode('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Create campaign</DialogTitle>
              <DialogDescription>
                Name the campaign. You&apos;ll get a code for your players next.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <Input
                label="Campaign name"
                placeholder="The Sunken Bell"
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
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? 'Creating…' : 'Create campaign'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Campaign created</DialogTitle>
              <DialogDescription>
                Give this code to your players. They enter it under Join
                campaign on their Characters page.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-2 py-6">
              <p className="type-small text-muted">Campaign code</p>
              <CopyCodeButton code={createdCode} className="type-num-lg" />
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
