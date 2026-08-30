'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/feedback/dialog';

import { AuthPageClient } from './AuthPageClient';

interface SignInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignInDialog({ open, onOpenChange }: SignInDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        className="max-w-[452px] gap-0 rounded-[18px] p-[26px]"
      >
        <DialogTitle className="sr-only">Sign in to RollKeeper</DialogTitle>
        <DialogDescription className="sr-only">
          Email yourself a six-digit code. Signing in does not upload your
          characters.
        </DialogDescription>
        <AuthPageClient embedded onFinished={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
