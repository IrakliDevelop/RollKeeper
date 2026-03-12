import { useState, useEffect } from 'react';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Returns a live-updating "time ago" string for the given date.
 * Updates every 5 seconds.
 */
export function useTimeAgo(date: Date | null): string | null {
  const [text, setText] = useState<string | null>(
    date ? formatTimeAgo(date) : null
  );

  useEffect(() => {
    if (!date) {
      setText(null);
      return;
    }

    setText(formatTimeAgo(date));
    const interval = setInterval(() => {
      setText(formatTimeAgo(date));
    }, 5000);

    return () => clearInterval(interval);
  }, [date]);

  return text;
}
