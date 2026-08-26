import { cn } from '@/utils/cn';

const ALLOWED_TAG = /&lt;(\/?)(p|strong|em|u|ul|ol|li)&gt;/gi;

/**
 * Marker details are persisted and can cross the DM/player boundary. Escape
 * everything, then restore only the exact attribute-free tags emitted by the
 * compact editor. Event handlers, links, images, styles and scripts remain
 * inert text rather than entering the DOM.
 */
export function sanitizeMarkerRichText(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);)/gi, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(ALLOWED_TAG, '<$1$2>');
}

export function MarkerRichText({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'marker-rich-text text-sm break-words [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeMarkerRichText(content) }}
    />
  );
}
