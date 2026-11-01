'use client';
import { useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Download, RotateCcw, Share2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';

interface CharacterActionsProps {
  onExport: () => void;
  onShare: () => void;
  onReset: () => void;
}
export function CharacterActions({
  onExport,
  onShare,
  onReset,
}: CharacterActionsProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingDialog = useRef<(() => void) | null>(null);
  const openDialog = (callback: () => void) => {
    pendingDialog.current = callback;
    setOpen(false);
  };
  const action = (callback: () => void) => {
    setOpen(false);
    callback();
  };
  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="sm"
            rightIcon={<ChevronDown size={16} aria-hidden />}
          >
            Character
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            onCloseAutoFocus={event => {
              const callback = pendingDialog.current;
              if (callback) {
                event.preventDefault();
                pendingDialog.current = null;
                triggerRef.current?.focus();
                callback();
              }
            }}
            aria-label="Character"
            align="end"
            sideOffset={8}
            className={`${OVERLAY_SURFACE} z-50 flex max-w-[calc(100vw-1rem)] flex-col gap-1 p-2`}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Download size={16} aria-hidden />}
              onClick={() => action(onExport)}
            >
              Export character
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Share2 size={16} aria-hidden />}
              onClick={() => openDialog(onShare)}
            >
              Share with QR code
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              leftIcon={<RotateCcw size={16} aria-hidden />}
              onClick={() => openDialog(onReset)}
            >
              Reset character
            </Button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
