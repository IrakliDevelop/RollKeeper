export const EXPORT_PALETTE = {
  // --surface-raised in [data-theme='dark']
  background: '#18221d',
  // --heading
  heading: '#e9e4d4',
  // --body
  body: '#b4b6a6',
  // --muted
  muted: '#949a8a',
  // --divider
  divider: '#2a3830',
  // Fonts are not embedded by the capture, so stay on the system stack.
  font: "system-ui, -apple-system, 'Segoe UI', sans-serif",
} as const;

/** Same rule the export always used: "Brenn Tallow" -> "brenn-tallow-statblock.png". */
export function exportFileName(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '-')}-statblock.png`;
}

export function abilityMod(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Remove emoji characters (keeps basic symbols like +, -, etc.) */
export function stripEmoji(text: string): string {
  return text.replace(
    /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
    ''
  );
}

/**
 * Strip ALL styling from rich-text HTML for clean image export.
 * Reference badges use Tailwind classes and emoji
 * icons — these don't render in html-to-image. Replace with bold+italic+
 * underline plain text so they're still identifiable in the exported image.
 */
export function cleanHtmlForExport(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;

  const walk = (node: Node): void => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;

        // Recurse into children first (bottom-up)
        walk(el);

        // Detect styled/classed spans (reference badges from referenceParser)
        const isStyledBadge =
          el.hasAttribute('style') ||
          el.hasAttribute('class') ||
          (el.tagName === 'SPAN' && el.getAttribute('title'));

        const text = stripEmoji(el.textContent || '').trim();

        if (isStyledBadge && text) {
          // Replace badge with bold+italic+underline plain text
          const replacement = document.createElement('b');
          const inner = document.createElement('i');
          const uline = document.createElement('u');
          uline.textContent = text;
          inner.appendChild(uline);
          replacement.appendChild(inner);
          el.replaceWith(replacement);
        } else if (isStyledBadge && !text) {
          // Empty after stripping emoji — remove entirely
          el.remove();
        } else {
          // Unstyled element — clean up attrs but keep structure
          el.removeAttribute('style');
          el.removeAttribute('class');
          // Re-apply list markers inline (Tailwind Preflight strips them)
          if (el.tagName === 'UL') {
            el.setAttribute(
              'style',
              'list-style-type:disc;padding-left:20px;margin:4px 0;'
            );
          } else if (el.tagName === 'OL') {
            el.setAttribute(
              'style',
              'list-style-type:decimal;padding-left:20px;margin:4px 0;'
            );
          } else if (el.tagName === 'LI') {
            el.setAttribute(
              'style',
              'display:list-item;list-style-position:outside;'
            );
          }
        }
      }
    }
  };

  walk(div);
  return stripEmoji(div.innerHTML);
}

export async function toDataUrl(src: string): Promise<string | null> {
  try {
    const url =
      src.includes('s3.') && src.includes('amazonaws.com')
        ? `/api/assets/proxy?url=${encodeURIComponent(src)}`
        : src;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
