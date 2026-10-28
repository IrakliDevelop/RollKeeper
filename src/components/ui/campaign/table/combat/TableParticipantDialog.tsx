'use client';

import { useState } from 'react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { Button } from '@/components/ui/forms/button';
import { Checkbox } from '@/components/ui/forms/checkbox';

export interface TableParticipantOption {
  actorId: string;
  name: string;
  detail: string;
  /** UI default for newly added members whose bound tokens are all DM-only. */
  hiddenByDefault: boolean;
}

/**
 * Participant picker over the scene's current members. Unchecked members
 * stay bystanders (present in the scene, not in initiative). One save is one
 * `setParticipants` command.
 */
export function TableParticipantDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: TableParticipantOption[];
  selected: string[];
  busy: boolean;
  onSave: (actorIds: string[], hiddenActorIds: string[]) => void;
}) {
  const [chosen, setChosen] = useState<string[]>(props.selected);
  const toggle = (actorId: string, checked: boolean) =>
    setChosen(previous =>
      checked
        ? previous.includes(actorId)
          ? previous
          : [...previous, actorId]
        : previous.filter(id => id !== actorId)
    );
  return (
    <Dialog
      open={props.open}
      onOpenChange={open => {
        if (open) setChosen(props.selected);
        props.onOpenChange(open);
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Choose participants</DialogTitle>
          <DialogDescription>
            Checked members roll initiative. Everyone else stays in the scene as
            a bystander.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {props.options.length === 0 ? (
            <p className="text-muted text-sm">
              Add members to this scene from the roster first.
            </p>
          ) : (
            <ul className="space-y-2">
              {props.options.map(option => (
                <li
                  key={option.actorId}
                  className="border-divider flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2"
                >
                  <Checkbox
                    aria-label={option.name}
                    checked={chosen.includes(option.actorId)}
                    onCheckedChange={checked => toggle(option.actorId, checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-heading truncate text-sm font-medium">
                      {option.name}
                    </p>
                    <p className="text-muted truncate text-xs">
                      {option.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={props.busy}
            onClick={() =>
              props.onSave(
                chosen,
                props.options
                  .filter(
                    option =>
                      option.hiddenByDefault &&
                      chosen.includes(option.actorId) &&
                      !props.selected.includes(option.actorId)
                  )
                  .map(option => option.actorId)
              )
            }
          >
            Save participants
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
