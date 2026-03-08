'use client';

import React, { useState, useEffect } from 'react';
import { LayoutGrid, ArrowRight, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/feedback/dialog-new';

interface NewLayoutPromptDialogProps {
  onAccept: () => void;
  onDismiss: () => void;
}

export default function NewLayoutPromptDialog({
  onAccept,
  onDismiss,
}: NewLayoutPromptDialogProps) {
  const [open, setOpen] = useState(false);
  const acceptedRef = React.useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    acceptedRef.current = true;
    setOpen(false);
    onAccept();
  };

  const handleDismiss = () => {
    setOpen(false);
    onDismiss();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={val => {
        if (!val && !acceptedRef.current) handleDismiss();
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-blue-500" />
            New Tabbed Layout Available
          </DialogTitle>
          <DialogDescription>
            A new way to navigate your character sheet
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="border-divider bg-surface-secondary rounded-lg border p-4">
              <div className="flex items-start gap-3">
                <div className="bg-accent-blue-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <Columns3 className="text-accent-blue-text h-5 w-5" />
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-heading font-medium">
                    Switch sections instantly with tabs
                  </p>
                  <p className="text-muted">
                    No more scrolling through collapsed sections. Jump between
                    Actions, Stats, Combat, Spells, Inventory, Features, and
                    Character details with a single click.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 py-2">
              <div className="border-divider flex flex-col items-center rounded-lg border p-3">
                <div className="bg-surface-secondary mb-1 h-2 w-12 rounded" />
                <div className="bg-surface-secondary mb-1 h-2 w-10 rounded" />
                <div className="bg-surface-secondary mb-1 h-2 w-12 rounded" />
                <div className="bg-surface-secondary h-2 w-8 rounded" />
                <span className="text-faint mt-1 text-[10px]">Before</span>
              </div>
              <ArrowRight className="text-muted h-4 w-4" />
              <div className="bg-accent-blue-bg flex flex-col items-center rounded-lg border border-blue-300 p-3 dark:border-blue-700">
                <div className="mb-1 flex gap-0.5">
                  <div className="h-2 w-4 rounded-t bg-blue-400" />
                  <div className="bg-surface-secondary h-2 w-4 rounded-t" />
                  <div className="bg-surface-secondary h-2 w-4 rounded-t" />
                </div>
                <div className="bg-surface-raised h-6 w-14 rounded-b" />
                <span className="text-accent-blue-text mt-1 text-[10px] font-medium">
                  After
                </span>
              </div>
            </div>

            <p className="text-faint text-center text-xs">
              You can switch back anytime in Settings & Features on the player
              dashboard.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={handleDismiss}>
            Maybe Later
          </Button>
          <Button variant="primary" onClick={handleAccept}>
            Try New Layout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
