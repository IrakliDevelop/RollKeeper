/**
 * Shared surface classes and prose CSS for the rich-text editors and the
 * rich-text renderer. The CSS is unlayered, so it beats Tailwind's
 * `@layer utilities` (the coarse-pointer font size wins over `type-body`).
 */

/** The editor box: input border, 4px radius, brass ring while the text has focus. */
export const RICH_TEXT_FRAME_CLASS =
  'border-input-border overflow-hidden rounded-sm border has-[.ProseMirror-focused]:outline-2 has-[.ProseMirror-focused]:outline-offset-2 has-[.ProseMirror-focused]:outline-ring';

/** The blank box shown until the editor mounts. */
export const RICH_TEXT_LOADING_CLASS = 'border-input-border rounded-sm border';

/** The toolbar strip. Callers add their own padding (`p-1` / `p-0.5`). */
export const RICH_TEXT_TOOLBAR_CLASS =
  'border-divider bg-surface flex flex-wrap items-center gap-1 border-b';

/** The inset well that holds the editable text. */
export const RICH_TEXT_WELL_CLASS = 'bg-input-bg relative';

/** The placeholder overlay. Callers set its offset to match the padding. */
export const RICH_TEXT_PLACEHOLDER_CLASS =
  'text-input-placeholder pointer-events-none absolute';

/** The rule between toolbar groups. */
export const RICH_TEXT_DIVIDER_CLASS = 'bg-divider h-6 w-px';

function under(root: string, ...selectors: string[]): string {
  return selectors.map(selector => `${root} ${selector}`).join(', ');
}

/**
 * Content rules for rich text under `root`. Paragraphs and lists inherit the
 * container's size, colour and line height; `root` itself gets none.
 */
export function richTextProseCss(root: string): string {
  return `
${under(root, 'p')} { margin: 0.5em 0; }
${under(root, 'ul', 'ol')} { margin: 0.5em 0; padding-left: 1.5rem; list-style-position: outside; }
${under(root, 'ul')} { list-style-type: disc; }
${under(root, 'ol')} { list-style-type: decimal; }
${under(root, 'li p')} { display: inline; margin: 0; }
${under(root, 'h1', 'h2', 'h3')} {
  font-family: var(--font-heading-family);
  color: var(--heading);
  line-height: 1.25;
  margin: 0.75em 0 0.25em;
}
${under(root, 'h1')} { font-size: 1.375em; font-weight: 700; }
${under(root, 'h2')} { font-size: 1.125em; font-weight: 700; }
${under(root, 'h3')} { font-size: 1em; font-weight: 600; }
${under(root, 'a')} {
  color: var(--brass-text);
  text-decoration: underline;
  text-underline-offset: 4px;
}
/* --font-mono lives in @theme inline, which emits it only when Tailwind sees
   it used, so the fallback repeats its value. */
${under(root, 'code', 'pre')} {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  font-size: 0.875em;
  color: var(--heading);
  background: var(--surface-inset);
  border: 1px solid var(--divider);
  border-radius: 4px;
}
${under(root, 'code')} { padding: 0.125em 0.25em; }
${under(root, 'pre')} { margin: 0.5em 0; padding: 0.5em 0.75em; overflow-x: auto; }
${under(root, 'pre code')} {
  font-size: inherit;
  background: none;
  border: 0;
  border-radius: 0;
  padding: 0;
}
${under(root, 'blockquote')} {
  margin: 0.5em 0;
  border-left: 2px solid var(--divider-strong);
  padding-left: 0.75em;
  color: var(--muted);
  font-style: italic;
}
${under(root, 'hr')} { margin: 1em 0; border: 0; border-top: 1px solid var(--divider); }
${under(root, 'table')} { margin: 0.5em 0; border-collapse: collapse; width: 100%; }
${under(root, 'td', 'th')} {
  border: 1px solid var(--divider);
  padding: 0.375em 0.5em;
  vertical-align: top;
  position: relative;
}
${under(root, 'th')} {
  background: var(--surface-secondary);
  color: var(--heading);
  font-weight: 600;
  text-align: left;
}
${root} > :first-child { margin-top: 0; }
${root} > :last-child { margin-bottom: 0; }
`;
}

/** Editor-only rules for the well under `scope`: focus, touch size, tables. */
export function richTextEditorCss(scope: string): string {
  return `
${scope} .ProseMirror { outline: none; }
@media (pointer: coarse) {
  ${scope} { font-size: 1rem; }
}
/* globals.css forces .ProseMirror p and li to --heading with !important, so
   a quote keeps its muted text only through a more specific !important. */
${scope} .ProseMirror blockquote :is(p, li) { color: var(--muted) !important; }
${scope} .tableWrapper { overflow-x: auto; }
/* Column resizing sets widths on <col>; a fixed layout honours them. */
${scope} .ProseMirror table { table-layout: fixed; }
/* The selected cell is a stacking context, so the overlay sits under its text. */
${scope} .selectedCell { z-index: 0; }
${scope} .selectedCell::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--brass-bg);
  pointer-events: none;
}
${scope} .column-resize-handle {
  position: absolute;
  top: 0;
  bottom: -2px;
  right: -2px;
  width: 4px;
  background: var(--brass-border);
  pointer-events: none;
}
${scope} .resize-cursor { cursor: col-resize; }
`;
}
