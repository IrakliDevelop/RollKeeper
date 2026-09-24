'use client';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/feedback/dialog';
import { getConditionIcon } from '@/utils/conditionIcons';
import type { SharedCondition } from '@/types/sharedState';

interface TokenConditionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name?: string;
  conditions: SharedCondition[];
  onCloseAutoFocus: (event: Event) => void;
}

/** Read-only: displays only the same shared conditions as the token icons. */
export function TokenConditionsDialog({
  open,
  onOpenChange,
  name,
  conditions,
  onCloseAutoFocus,
}: TokenConditionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        onCloseAutoFocus={onCloseAutoFocus}
        onPointerDown={event => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>
            {name ? `${name} — Conditions` : 'Conditions'}
          </DialogTitle>
          <DialogDescription>Active conditions and effects.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="space-y-4">
            {conditions.map((condition, index) => {
              const Icon = getConditionIcon(
                condition.name,
                condition.kind,
                condition.icon
              );
              return (
                <li key={`${condition.name}-${index}`} className="flex gap-3">
                  <Icon
                    aria-hidden="true"
                    className="text-body mt-1 h-5 w-5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-heading font-semibold">
                      {condition.name}
                      {condition.stackCount !== undefined &&
                      condition.stackCount > 1
                        ? ` ×${condition.stackCount}`
                        : ''}
                    </p>
                    <p className="text-body text-sm break-words whitespace-pre-wrap">
                      {condition.description?.trim() ||
                        'No description shared.'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
