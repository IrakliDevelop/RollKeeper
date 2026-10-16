/** Saves combat history text/JSON as a local file (no network). */
export function downloadCombatHistory(
  filename: string,
  content: string,
  type: 'application/json' | 'text/plain'
): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
