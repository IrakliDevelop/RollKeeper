import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/feedback/dialog';

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map(word => word[0]!.toUpperCase())
    .join('');
}

/** Avatar, name, one-line description (artboard 1b) — the dialog's own
 *  close button (Radix's default top-right X on `DialogContent`) covers the
 *  "close button" requirement without a bespoke control. */
export function PlayerShopHeader({
  merchantName,
  merchantDescription,
  merchantAvatarUrl,
}: {
  merchantName: string;
  merchantDescription?: string;
  merchantAvatarUrl?: string;
}) {
  return (
    <DialogHeader className="flex-row items-center gap-4 space-y-0">
      <div className="border-divider bg-surface-secondary text-muted flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 text-xl font-bold">
        {merchantAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={merchantAvatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          initials(merchantName)
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <DialogTitle>{merchantName}</DialogTitle>
        {merchantDescription && (
          <DialogDescription>{merchantDescription}</DialogDescription>
        )}
      </div>
    </DialogHeader>
  );
}
