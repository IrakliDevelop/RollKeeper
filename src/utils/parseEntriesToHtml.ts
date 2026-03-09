/**
 * Shared utility for converting 5etools JSON entries into TipTap-compatible HTML.
 * Used by weaponDataLoader, magicItemDataLoader, and armorDataLoader.
 */

export function stripTags(text: string): string {
  return text
    .replace(/\{@\w+\s+([^|}]+?)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function processInlineText(raw: string): string {
  let text = raw;

  text = text.replace(
    /\{@spell\s+([^|}]+?)(?:\|[^}]*)?\}/g,
    (_m, name) => `<em>${escapeHtml(name)}</em>`
  );

  text = text.replace(
    /\{@condition\s+([^|}]+?)(?:\|[^}]*)?\}/g,
    (_m, name) => `<em>${escapeHtml(name)}</em>`
  );

  text = text.replace(
    /\{@(\w+)\s+([^|}]+?)(?:\|[^}]*)?\}/g,
    (_m, _tag, display) => escapeHtml(display)
  );
  text = text.replace(/\{@(\w+)\s+([^}]+)\}/g, (_m, _tag, display) =>
    escapeHtml(display)
  );

  return text;
}

function parseListItems(items: unknown[]): string {
  const lis = items
    .map(item => {
      if (typeof item === 'string') {
        return `<li>${processInlineText(item)}</li>`;
      }

      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        if (obj.type === 'item') {
          const name = obj.name
            ? `<strong>${escapeHtml(String(obj.name))}.</strong> `
            : '';
          let content = '';
          if (Array.isArray(obj.entries)) {
            content = obj.entries
              .map(e => (typeof e === 'string' ? processInlineText(e) : ''))
              .join(' ');
          } else if (typeof obj.entry === 'string') {
            content = processInlineText(obj.entry);
          }
          return `<li>${name}${content}</li>`;
        }
      }

      return '';
    })
    .filter(Boolean);

  return `<ul>${lis.join('')}</ul>`;
}

function parseTable(obj: Record<string, unknown>): string {
  let html = '<table>';

  const caption = obj.caption as string | undefined;
  if (caption) {
    html += `<caption>${escapeHtml(caption)}</caption>`;
  }

  const colLabels = obj.colLabels as string[] | undefined;
  if (colLabels && colLabels.length > 0) {
    html += '<thead><tr>';
    for (const label of colLabels) {
      html += `<th>${processInlineText(label)}</th>`;
    }
    html += '</tr></thead>';
  }

  const rows = obj.rows as unknown[][] | undefined;
  if (rows && rows.length > 0) {
    html += '<tbody>';
    for (const row of rows) {
      html += '<tr>';
      for (const cell of row) {
        const cellText =
          typeof cell === 'string' ? processInlineText(cell) : '';
        html += `<td>${cellText}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody>';
  }

  html += '</table>';
  return html;
}

export function parseEntriesToHtml(entries: unknown[]): string {
  const parts: string[] = [];

  for (const entry of entries) {
    if (typeof entry === 'string') {
      parts.push(`<p>${processInlineText(entry)}</p>`);
      continue;
    }

    if (typeof entry !== 'object' || entry === null) continue;

    const obj = entry as Record<string, unknown>;

    if (obj.type === 'list' && Array.isArray(obj.items)) {
      parts.push(parseListItems(obj.items));
      continue;
    }

    if (obj.type === 'entries' && Array.isArray(obj.entries)) {
      if (obj.name) {
        parts.push(`<h3>${escapeHtml(String(obj.name))}</h3>`);
      }
      parts.push(parseEntriesToHtml(obj.entries));
      continue;
    }

    if (obj.type === 'section' && Array.isArray(obj.entries)) {
      if (obj.name) {
        parts.push(`<h2>${escapeHtml(String(obj.name))}</h2>`);
      }
      parts.push(parseEntriesToHtml(obj.entries));
      continue;
    }

    if (obj.type === 'inset' || obj.type === 'quote') {
      const inner = Array.isArray(obj.entries)
        ? parseEntriesToHtml(obj.entries)
        : '';
      const heading = obj.name
        ? `<p><strong>${escapeHtml(String(obj.name))}</strong></p>`
        : '';
      parts.push(`<blockquote>${heading}${inner}</blockquote>`);
      continue;
    }

    if (obj.type === 'table') {
      parts.push(parseTable(obj));
      continue;
    }

    if (Array.isArray(obj.entries)) {
      parts.push(parseEntriesToHtml(obj.entries));
      continue;
    }
  }

  return parts.join('');
}
