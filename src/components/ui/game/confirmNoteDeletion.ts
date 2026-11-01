import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';

export function confirmNoteDeletion(title: string): Promise<boolean> {
  const name = title.trim();
  return confirmDialog({
    title: name ? `Delete ${name}?` : 'Delete this note?',
    message: "This can't be undone.",
    confirmLabel: 'Delete note',
    cancelLabel: 'Cancel',
    tone: 'danger',
  });
}
