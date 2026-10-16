'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { isRunLabel } from '@/lib/table/schema';

/** Creates a labelled scene run (saved on this device). */
export function TableNewRunDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultLabel: string;
  busy: boolean;
  onCreate: (label: string) => void;
}) {
  const [label, setLabel] = useState(props.defaultLabel);
  const valid = isRunLabel(label.trim());
  return (
    <Dialog
      open={props.open}
      onOpenChange={open => {
        if (open) setLabel(props.defaultLabel);
        props.onOpenChange(open);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>New scene run</DialogTitle>
          <DialogDescription>
            A run is a prepared fight in this scene, saved on this device.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={event => {
            event.preventDefault();
            if (valid) props.onCreate(label.trim());
          }}
        >
          <Input
            id="table-new-run-label"
            label="Run label"
            value={label}
            maxLength={400}
            onChange={event => setLabel(event.target.value)}
            error={valid ? undefined : 'Use 1 to 200 characters.'}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => props.onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || props.busy}>
              Create run
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
