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
            {name ? `Conditions on ${name}` : 'Conditions'}
          </DialogTitle>
          <DialogDescription>Active conditions and effects.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ul className="divide-divider divide-y">
            {conditions.map((condition, index) => {
              const Icon = getConditionIcon(
                condition.name,
                condition.kind,
                condition.icon
              );
              return (
                <li
                  key={`${condition.name}-${index}`}
                  className="flex gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <Icon
                    aria-hidden="true"
                    className="text-muted mt-0.5 size-5 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="type-ui text-heading">
                      {condition.name}
                      {condition.stackCount !== undefined &&
                      condition.stackCount > 1
                        ? ` ×${condition.stackCount}`
                        : ''}
                    </p>
                    <p className="type-small text-body break-words whitespace-pre-wrap">
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
